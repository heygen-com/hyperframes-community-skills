"""Pinhole projector matching assets/kit/engine.js camAt(): square frame, vertical fov,
camera = tgt + dist * (sin az cos el, sin el, cos az cos el).

Use it to place background elements from the photo:
    python3 -c "from project import *; c = cam([0, 2, 0], 0, 5, 20, 57); print(at_depth(c, 470, 300, 100))"
  cam(tgt, az, el, dist, fov)     - camera from the same numbers as a cams.PHOTO state
  at_depth(c, px, py, depth, W)   - world point for photo pixel (px, py) at a forward distance (things of known size)
  at_y(c, px, py, Y, W)           - world point where that pixel's ray meets height Y (ground contacts, rail tops)
  proj(c, point, W)               - world point → (px, py, depth)
Pixels are in a W×W square (default 540) matching reference/target-square.jpg scaled to W.
"""
import math, numpy as np, sys, json
def cam(tgt, az, el, dist, fov):
    az, el = math.radians(az), math.radians(el)
    pos = np.array(tgt) + dist * np.array([math.sin(az)*math.cos(el), math.sin(el), math.cos(az)*math.cos(el)])
    f = np.array(tgt) - pos; f /= np.linalg.norm(f)
    r = np.cross(f, [0,1,0]); r /= np.linalg.norm(r); u = np.cross(r, f)
    return dict(pos=pos, f=f, r=r, u=u, t=math.tan(math.radians(fov)/2))
def ray(c, px, py, W=540):   # pixel (square W) → unit ray
    x = (px/W*2-1)*c['t']; y = (1-py/W*2)*c['t']
    d = c['f'] + x*c['r'] + y*c['u']; return d/np.linalg.norm(d)
def at_depth(c, px, py, depth, W=540):   # point along the ray whose camera-forward distance = depth
    d = ray(c, px, py, W); s = depth/np.dot(d, c['f']); return c['pos'] + d*s
def at_y(c, px, py, Y, W=540):
    d = ray(c, px, py, W); s = (Y-c['pos'][1])/d[1]; return c['pos'] + d*s if s > 0 else None
def proj(c, p, W=540):
    v = np.array(p) - c['pos']; z = np.dot(v, c['f']); x = np.dot(v, c['r'])/z/c['t']; y = np.dot(v, c['u'])/z/c['t']
    return ((x+1)/2*W, (1-y)/2*W, z)
