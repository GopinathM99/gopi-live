(function(root){
  function landing(base, moving, tolerance = 7) {
    const offset = moving.x - base.x;
    if (Math.abs(offset) <= tolerance) return { x: base.x, width: base.width, perfect: true, cut: null };
    const left = Math.max(base.x, moving.x), right = Math.min(base.x + base.width, moving.x + moving.width);
    if (right <= left) return null;
    const cut = offset > 0 ? { x: right, width: moving.x + moving.width - right } : { x: moving.x, width: left - moving.x };
    return { x: left, width: right - left, perfect: false, cut };
  }
  const api = { landing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.StackEngine = api;
})(globalThis);
