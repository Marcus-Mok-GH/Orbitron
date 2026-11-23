const { createOrbitronApp } = require("../dist-server/lambda.cjs");

let appPromise;

module.exports = async function handler(req, res) {
  if (!appPromise) appPromise = createOrbitronApp();
  const app = await appPromise;
  return app(req, res);
};
