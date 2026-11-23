import lambda from "../dist-server/lambda.cjs";

export default async function handler(req, res) {
  const app = await lambda.getApp();
  return app(req, res);
}
