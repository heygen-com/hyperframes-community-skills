export async function hardenPage(page) {
  const allowedProtocols = new Set(["about:", "blob:", "data:"]);
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const protocol = new URL(request.url()).protocol;
    if (allowedProtocols.has(protocol)) {
      request.continue();
    } else {
      request.abort("blockedbyclient");
    }
  });
}
