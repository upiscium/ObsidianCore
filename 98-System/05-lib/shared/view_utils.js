(() => {
  function normalizeDate(value) {
    if (!value) return null;
    if (value.toFormat) return value.toFormat("yyyy-MM-dd");
    return String(value);
  }

  function compareFileMtimeDesc(a, b, compare) {
    return compare(b?.file?.mtime, a?.file?.mtime);
  }

  return Object.freeze({
    normalizeDate,
    compareFileMtimeDesc,
  });
})()
