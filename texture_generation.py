import numpy as np
import imageio
from numba import jit
from scipy.interpolate import RegularGridInterpolator
from scipy.ndimage.filters import gaussian_filter



def get_3d_interpolator(points=10, method='linear'):
    grid_points = np.random.randn(points, points, points) / points
    xyz = np.linspace(-1, 1, points)
    interpolator = RegularGridInterpolator((xyz, xyz, xyz), grid_points, method=method)
    return interpolator

def to_uint8(array, floor=0.0, ceil=1.0):
    return (255 * ((ceil - floor)
            * (array - array.min()) / (array.max() - array.min())
            + floor)).astype(np.uint8)

# def to_uint8_c(array, floor=0.0, ceil=1.0):
#     return np.stack((
#         to_uint8(array[:, :, 0], floor, ceil),
#         to_uint8(array[:, :, 1], floor, ceil),
#         to_uint8(array[:, :, 2], floor, ceil)
#     ), axis=2)

def gen_3d_waves(xres, yres, zres, density=0.001, iterations=20):
    u = (np.random.random((xres, yres, zres)) < density).astype(np.float64)
    v = np.zeros((xres-2, yres-2, zres-2))
    for i in range(iterations):
        # numerically estimate second derivatives
        d2x = u[:-2,1:-1,1:-1] - 2 * u[1:-1,1:-1,1:-1] + u[2:,1:-1,1:-1]
        d2y = u[1:-1,:-2,1:-1] - 2 * u[1:-1,1:-1,1:-1] + u[1:-1,2:,1:-1]
        d2z = u[1:-1,1:-1,:-2] - 2 * u[1:-1,1:-1,1:-1] + u[1:-1,1:-1,2:]
        # add to velocity
        v += (d2x + d2y + d2z)
        # add velocity to position
        u[1:-1, 1:-1, 1:-1] += v
    return u

def gen_cratermap(res=100, method='linear', density=0.001, amplitude=100):
    cratermap = gen_3d_waves(res+10, res+10, res+10, density)[5:-5,5:-5,5:-5]
    cratermap = amplitude * (cratermap - cratermap.min()) / (cratermap.max() - cratermap.min())
    pts = np.linspace(-1, 1, res)
    return RegularGridInterpolator((pts, pts, pts), cratermap, method=method)
        
class TextureGenerator:
    def __init__(self, points, thetawidth=2000, crater_density=0):
        self.points = points
        self.interpolators = [get_3d_interpolator(p) for p in points]
        self.red_interp = None
        self.green_interp = None
        self.blue_interp = None
        theta = np.linspace(0, 2 * np.pi, thetawidth)
        phi = np.linspace(0, np.pi, thetawidth // 2)
        theta_, phi_ = np.meshgrid(theta, phi)
        self.x = np.sin(phi_) * np.cos(theta_)
        self.y = np.sin(phi_) * np.sin(theta_)
        self.z = np.cos(phi_)
        self.craters = crater_density > 0
        if self.craters:
            self.cratermap = gen_cratermap(density=crater_density)
    
    def get_texture(self, blur=0):
        out = np.mean(
            [interpolator((self.x, self.y, self.z)) for interpolator in self.interpolators],
            axis=0
        )
        if self.craters:
            out += self.cratermap((self.x, self.y, self.z))
        if blur:
            out = gaussian_filter(out, sigma=blur, mode='wrap')
        return out - out.min()
    
    def create_color_interpolators(self):
        self.red_interp = [get_3d_interpolator(p) for p in self.points[:2]]
        self.green_interp = [get_3d_interpolator(p) for p in self.points[:2]]
        self.blue_interp = [get_3d_interpolator(p) for p in self.points[:2]]
    
    def colorize(self, texture, base_color=(0.5, 0.5, 0.7), noise_amp=0.05):
        if noise_amp == 0:
            return np.stack((base_color[0] * texture,
                             base_color[1] * texture,
                             base_color[2] * texture), axis=2)
        if self.red_interp is None:
            self.create_color_interpolators()
        red = noise_amp * np.mean([interp((self.x, self.y, self.z))
                                  for interp in self.red_interp], axis=0)
        red -= red.min()
        green = noise_amp * np.mean([interp((self.x, self.y, self.z))
                                    for interp in self.green_interp], axis=0)
        green -= green.min()
        blue = noise_amp * np.mean([interp((self.x, self.y, self.z))
                                   for interp in self.blue_interp], axis=0)
        blue -= blue.min()
        return np.stack((
            base_color[0] * texture + red,
            base_color[1] * texture + green,
            base_color[2] * texture + blue
        ), axis=2)


def get_gradient(heightmap, positive=True):
    thetawidth, phiwidth = heightmap.shape
    phi = np.linspace(0, np.pi, phiwidth)
    theta_step = 2*np.pi / thetawidth
    # calculate distances between pixels in the same row
    longitude_widths = np.sqrt((np.sin(phi) * (np.cos(theta_step) - 1))**2
                               + (np.sin(phi) * np.sin(theta_step))**2)
    # calculate distance between pixels in the same column
    latitude_width = np.pi / phiwidth
    # now compute differences, normalizing by distance
    theta_dists = (np.take(heightmap, list(range(1, phiwidth)) + [0], axis=1)
                   - heightmap) @ np.diag(longitude_widths)
    phi_dists = heightmap[1:, :] - heightmap[:-1, :] * latitude_width
    phi_dists = np.concatenate((phi_dists[0, :].reshape(1, -1), phi_dists))
    gradient = (theta_dists + phi_dists) / 2
    if positive:
        gradient = np.abs(gradient)
    return gradient

@jit
def fill_colormap(heightmap, gradient, flat, steep, high, water, waterline):
    red = np.empty(gradient.shape)
    green = np.empty(gradient.shape)
    blue = np.empty(gradient.shape)
    specular = np.empty(gradient.shape, dtype=np.uint8)
    min_height, max_height = heightmap.min(), heightmap.max()
    heightmap = (heightmap - min_height) / (max_height - min_height)
    min_grad, max_grad = gradient.min(), gradient.max()
    gradient = (gradient - min_grad) / (max_grad - min_grad)
    for i in range(gradient.shape[0]):
        for j in range(gradient.shape[1]):
            gradval = gradient[i, j]
            heightval = heightmap[i, j]
            if heightval < waterline:
                red[i, j] = water[0]
                green[i, j] = water[1]
                blue[i, j] = water[2]
                specular[i, j] = 255
            else:
                red[i, j] = (flat[0] * (1 - gradval) + steep[0] * gradval) \
                    * (1 - heightval) + high[0] * heightval
                green[i, j] = flat[1] * (1 - gradval) + steep[1] * gradval \
                    * (1 - heightval) + high[1] * heightval
                blue[i, j] = flat[2] * (1 - gradval) + steep[2] * gradval \
                    * (1 - heightval) + high[2] * heightval
                specular[i, j] = 0
    return np.stack((red, green, blue), axis=2), specular

@jit
def smart_cull(colormap):
    for i in range(colormap.shape[0]):
        for j in range(colormap.shape[1]):
            maxchannel = colormap[i, j, :].max()
            minchannel = colormap[i, j, :].min()
            maxdiff = maxchannel - 255
            if maxdiff > 0:
                colormap[i, j, 0] -= maxdiff
                colormap[i, j, 1] -= maxdiff
                colormap[i, j, 2] -= maxdiff
            elif minchannel < 0:
                colormap[i, j, 0] += minchannel
                colormap[i, j, 1] += minchannel
                colormap[i, j, 2] += minchannel
    return colormap.astype(np.uint8)                
    
            

class PlanetGenerator(TextureGenerator):
    
    def __init__(self, points, thetawidth=2000, crater_density=0):
        super().__init__(points, thetawidth, crater_density)
        self.heightmap = None
    
    def get_heightmap(self, blur=0):
        # alias for get_texture
        return self.get_texture(blur)

    def gen_color_noise(self, noise_amp=0.2):
        if self.red_interp is None:
            self.create_color_interpolators()
        red = noise_amp * np.mean([interp((self.x, self.y, self.z))
                                  for interp in self.red_interp], axis=0)
        red -= red.min()
        green = noise_amp * np.mean([interp((self.x, self.y, self.z))
                                    for interp in self.green_interp], axis=0)
        green -= green.min()
        blue = noise_amp * np.mean([interp((self.x, self.y, self.z))
                                   for interp in self.blue_interp], axis=0)
        blue -= blue.min()
        noise = np.stack((red, green, blue), axis=2)
        noise *= (255 * noise_amp / noise.max())
        return noise
    
    def get_colormap(self, flat=(3, 26, 8), steep=(42, 46, 18),
                     high=(139, 140, 130), water=(23, 52, 120),
                     waterline=0.5, noise_amp=0.2):
        if self.heightmap is None:
            self.heightmap = self.get_heightmap()
        gradient = get_gradient(self.heightmap)
        # get colorized and specular maps
        colorized, specular = fill_colormap(self.heightmap, gradient,
                                            flat, steep, high, water, waterline)
        # add noise to color map, then cull
        if noise_amp:
            colorized += self.gen_color_noise(noise_amp)
        colorized = smart_cull(colorized)
        # adjust height map to account for water
        cutoff = waterline * self.heightmap.max() + (1 - waterline) * self.heightmap.min()
        heightmap = self.heightmap.copy()
        heightmap[heightmap < cutoff] = cutoff
        return to_uint8(heightmap), colorized, specular
        
    
# EXAMPLE OF USING TEXTURE GENERATOR FOR SIMPLE ROCKY PLANET
# # generate height map
# imageio.imwrite('img/height0.png', to_uint8(TextureGenerator(
#         [5, 10, 15, 20],
#     ).get_texture(blur=10)))

# # generate surface map
# gen = TextureGenerator([5, 10, 20, 100, 200])
# texture = gen.get_texture(blur=5)
# colorized = gen.colorize(texture)
# imageio.imwrite('img/surface0.png', to_uint8(colorized, 0.2, 0.6))

# GREEN PLANET (0)
# p = PlanetGenerator([5, 10, 15, 20, 25, 30, 40, 60, 75])
# h, c, s = p.get_colormap()
# imageio.imwrite('height0.png', h); imageio.imwrite('surface0.png', c); imageio.imwrite('specular0.png', s)

# ROCKY PLANET (1)
# p = PlanetGenerator([5, 10, 15, 20, 25, 30, 40])
# h, c, s = p.get_colormap(flat=(77, 23, 15), steep=(102, 61, 44),
#                           high=(56, 29, 25), waterline=0, noise_amp=0.1)
# imageio.imwrite('height1.png', h); imageio.imwrite('surface1.png', c); imageio.imwrite('specular1.png', s)

# GAS PLANET (4)
# p = PlanetGenerator([5, 10, 20, 30])
# h, c, s = p.get_colormap(flat=(35, 69, 79), steep=(56, 52, 99),
#                          high=(135, 67, 30), waterline=0, noise_amp=0.4)
# imageio.imwrite('img/surface4.png', c)

# GAS PLANET MOON (5)
# p = PlanetGenerator([5, 10, 15, 20, 25, 30])
# h, c, s = p.get_colormap(flat=(54, 42, 35), steep=(77, 69, 64),
#                           high=(64, 30, 8), waterline=0, noise_amp=0.1)
# imageio.imwrite('img/height5.png', h); imageio.imwrite('img/surface5.png', c)

# GAS PLANET MOON (6)
# p = PlanetGenerator([5, 10, 15, 20, 25, 30, 40])
# h, c, s = p.get_colormap(flat=(22, 31, 9), steep=(63, 71, 57),
#                           high=(213, 214, 210), waterline=0.6, water=(51, 86, 166),
#                           noise_amp=0.1)
# imageio.imwrite('img/height6.png', h); imageio.imwrite('img/surface6.png', c); imageio.imwrite('img/specular6.png', s)

# GREEN PLANET MOON (7)
p = PlanetGenerator([5, 10, 15])
h, c, s = p.get_colormap(flat=(148, 145, 143), steep=(84, 81, 79),
                         high=(117, 111, 107), waterline=0, noise_amp=0.05)
imageio.imwrite('img/surface7.png', c); imageio.imwrite('img/height7.png', h)

