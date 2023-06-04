import { useQuery } from "@tanstack/react-query";

export interface Sign {
  id: number;
  orderRef: string;
  status: string;
  hintCode: string;
  createdAt: Date;
}

export default function useSigns() {
  return useQuery(["signs"], async () => {
    return (await (
      await fetch(process.env.NEXT_PUBLIC_URL + "/signs")
    ).json()) as Sign[];
  });
}
