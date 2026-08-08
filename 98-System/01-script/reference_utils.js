(() => {
  function asArray(value) {
    if (value === null || value === undefined || value === "") return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object" && value !== null && typeof value.array === "function") {
      return value.array();
    }
    return [value];
  }

  function normalizeLinkpath(value) {
    if (value && typeof value === "object" && value.path) {
      return