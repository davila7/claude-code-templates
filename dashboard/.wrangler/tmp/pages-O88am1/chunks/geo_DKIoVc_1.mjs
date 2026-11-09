globalThis.process ??= {}; globalThis.process.env ??= {};
function getCountry(request) {
  const country = request.headers.get("cf-ipcountry");
  if (!country || country === "XX") return null;
  return country;
}

export { getCountry as g };
