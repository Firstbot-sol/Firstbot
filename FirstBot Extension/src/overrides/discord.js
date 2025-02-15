(function () {
  const previousRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    try {
      return previousRemoveChild.call(this, child);
    } catch (e) {
      if (e?.toString().includes('NotFoundError')) {
        return;
      }
      throw e;
    }
  };
})();