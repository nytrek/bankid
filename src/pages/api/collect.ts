import { AuthResponse, BankIdClient, CollectResponse } from "bankid";
import { getCookie } from "cookies-next";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CollectResponse | string>
) {
  try {
    if (getCookie("sign", { req, res })) {
      const client = new BankIdClient();
      const qr = JSON.parse(
        getCookie("sign", { req, res }) as string
      ) as AuthResponse;
      const collect = await client.collect({
        orderRef: qr.orderRef,
      });
      res.status(200).json(collect);
    } else res.status(200);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
}
