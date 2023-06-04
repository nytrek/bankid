import { AuthResponse, BankIdClient } from "bankid";
import { deleteCookie, getCookie, setCookie } from "cookies-next";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import requestIp from "request-ip";

//https://github.com/anyfin/bankid/issues/51
function generateQr(qrStartSecret: string, qrStartToken: string, time: number) {
  const qrAuthCode = crypto
    .createHmac("sha256", qrStartSecret)
    .update(`${time}`)
    .digest("hex");
  return `bankid.${qrStartToken}.${time}.${qrAuthCode}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<string>
) {
  try {
    const { pno } = req.body;
    if (getCookie("sign", { req, res })) {
      const qr = JSON.parse(getCookie("sign", { req, res }) as string);
      const qrTime = parseInt(`${(Date.now() - qr.startTime) / 1000}`, 10);
      return res
        .status(200)
        .send(generateQr(qr.qrStartSecret, qr.qrStartToken, qrTime));
    } else {
      const now = Date.now();
      //const dir = path.resolve(process.env.PATH as string);
      const client = new BankIdClient();
      // {
      //   production: true,
      //   pfx: fs.readFileSync(dir),
      //   passphrase: process.env.PASSPHRASE,
      // }
      const sign = (await client.sign({
        personalNumber: pno,
        userVisibleData: "Signature at bankid.nytrek.dev",
        endUserIp: requestIp.getClientIp(req) as string,
      })) as AuthResponse & { startTime: number };
      sign.startTime = now;
      setCookie("sign", JSON.stringify(sign), {
        req,
        res,
        maxAge: 60 * 6 * 24,
      });
      return res.status(200).send("success");
    }
  } catch (err: any) {
    deleteCookie("sign");
    return res.status(500).send(err.message);
  }
}
