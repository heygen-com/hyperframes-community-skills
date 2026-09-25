# shared by the skill's shell scripts (sourced, not executed)
HF_VERSION=0.8.74                       # tested HyperFrames CLI; bump only after re-testing
HF="npx --yes hyperframes@$HF_VERSION"
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
need_node() {
  node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' 2>/dev/null || { echo "error: Node 22+ is required (found $(node -v 2>/dev/null || echo none))" >&2; exit 1; }
}
need_py() {
  python3 -c "import PIL, numpy" 2>/dev/null || { echo "error: python3 with Pillow and numpy is required: pip install -r $SKILL_DIR/scripts/requirements.txt" >&2; exit 1; }
}
need_scipy() {
  python3 -c "import scipy" 2>/dev/null || { echo "error: scipy is required for the tracer: pip install -r $SKILL_DIR/scripts/requirements.txt" >&2; exit 1; }
}
DEV_NULL_JS='// Dev inspection only: set a camera {tgt, az, el, dist, fov} to lock the view for snapshots. Must be null for the film.
export const DEV_CAM = null;'
