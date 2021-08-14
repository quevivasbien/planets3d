import numpy as np
import imageio
from scipy.interpolate import RegularGridInterpolator
from scipy.ndimage.filters import gaussian_filter



def get_3d_interpolator(xpoints=10, ypoints=10, zpoints=10, method='linear'):
    grid_points = np.random.randn(xpoints, ypoints, zpoints)
    xi = np.linspace(-1, 1, xpoints)
    yi = np.linspace(-1, 1, ypoints)
    zi = np.linspace(-1, 1, zpoints)
    interpolator = RegularGridInterpolator((xi, yi, zi), grid_points, method=method)
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
    def __init__(self, points, thetawidth=2000, phiwidth=1000, crater_density=0):
        self.points = points
        self.interpolators = [get_3d_interpolator(p, p, p) for p in points]
        self.red_interp = None
        self.green_interp = None
        self.blue_interp = None
        theta = np.linspace(0, 2 * np.pi, thetawidth)
        phi = np.linspace(0, np.pi, phiwidth)
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
        self.red_interp = [get_3d_interpolator(p, p, p) for p in self.points[:2]]
        self.green_interp = [get_3d_interpolator(p, p, p) for p in self.points[:2]]
        self.blue_interp = [get_3d_interpolator(p, p, p) for p in self.points[:2]]
    
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

# generate height maps
# imageio.imwrite('img/height0.png', to_uint8(TextureGenerator(
#         [5, 10, 15, 20],
#     ).get_texture(blur=10)))

# imageio.imwrite('img/height1.png', to_uint8(TextureGenerator(
#         [5, 10, 15, 20, 30],
#     ).get_texture(blur=10)))

imageio.imwrite('img/height2.png', to_uint8(TextureGenerator(
        [10, 15, 20],
    ).get_texture(blur=5)))

# generate surface maps
gen = TextureGenerator([5, 10, 20, 100, 200])
texture = gen.get_texture(blur=5)
colorized = gen.colorize(texture)
imageio.imwrite('img/surface0.png', to_uint8(colorized, 0.2, 0.6))

gen = TextureGenerator([5, 10, 20, 100, 150])
texture = gen.get_texture(blur=5)
colorized = gen.colorize(texture, base_color=(1.0, 0.05, 0.05), noise_amp=0.05)
imageio.imwrite('img/surface1.png', to_uint8(colorized, 0.1, 0.7))

gen = TextureGenerator([10, 20, 100, 110])
texture = gen.get_texture(blur=5)
colorized = gen.colorize(texture, base_color=(0.80, 0.45, 0.25), noise_amp=0.05)
imageio.imwrite('img/surface2.png', to_uint8(colorized, 0.2, 0.7))
