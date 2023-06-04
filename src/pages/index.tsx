import useSigns, { Sign } from "@/hooks/useSigns";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CollectResponse } from "bankid";
import clsx from "clsx";
import { deleteCookie, getCookie } from "cookies-next";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/router";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

const environments = {
  failed: "text-gray-400 bg-gray-400/10 ring-gray-400/20",
  complete: "text-indigo-400 bg-indigo-400/10 ring-indigo-400/30",
};

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: signs, isLoading } = useSigns();
  const [userSign, setUserSign] = useState(false);
  const pnoRef = useRef<HTMLInputElement | null>(null);
  const interval = useRef<NodeJS.Timeout | null>(null);
  const [data, setData] = useState<string | null>(null);
  const reset = () => {
    setData(null);
    setUserSign(false);
    deleteCookie("sign");
    clearInterval(interval.current as NodeJS.Timeout);
  };
  const createSign = useMutation(
    async (sign: Sign) => {
      const { hintCode, ...payload } = sign;
      const response = await toast.promise(
        fetch(process.env.NEXT_PUBLIC_URL + "/signs/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...payload,
            hintCode: hintCode ? hintCode : "success",
          }),
        }),
        {
          loading: "Loading...",
          success: "Sign Created!",
          error: "Error!",
        }
      );
      const { data, error } = await response.json();
      if (error) throw new Error(error);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["signs"]);
      },
      onError: (err: any) => {
        console.log(err.message);
      },
    }
  );
  const deleteSign = useMutation(
    async (id: number) => {
      const response = await toast.promise(
        fetch(process.env.NEXT_PUBLIC_URL + "/signs/delete/" + id, {
          method: "DELETE",
        }),
        {
          loading: "Loading...",
          success: "Sign Deleted!",
          error: "Error!",
        }
      );
      const { data, error } = await response.json();
      if (error) throw new Error(error);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["signs"]);
      },
      onError: (err: any) => {
        console.log(err.message);
      },
    }
  );
  const collect = async () => {
    try {
      const response = await fetch("/api/collect");
      if (response.status !== 200) {
        return reset();
      }
      const collect = (await response.json()) as CollectResponse;
      if (collect.hintCode === "userSign") setUserSign(true);
      else setUserSign(false);
      if (collect.status === "failed") {
        createSign.mutate({
          orderRef: collect.orderRef,
          status: collect.status,
          hintCode: collect.hintCode as string,
        } as Sign);
        return reset();
      } else if (collect.status === "complete") {
        createSign.mutate({
          orderRef: collect.orderRef,
          status: collect.status,
          hintCode: collect.hintCode as string,
        } as Sign);
        return reset();
      }
    } catch (err: any) {
      console.log(err.message);
    }
  };
  const generate = async () => {
    try {
      const response = await fetch("/api/sign");
      if (response.status !== 200) return;
      const qrCode = await response.text();
      setData(
        await QRCode.toDataURL(qrCode, {
          errorCorrectionLevel: "L",
        })
      );
    } catch (err: any) {
      console.log(err.message);
    }
  };
  const initiate = async () => {
    try {
      const response = await fetch("/api/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pno: pnoRef.current?.value,
        }),
      });
      if (response.status === 200) {
        if (pnoRef.current?.value) {
          const autoStartToken = (await response.json()).autoStartToken;
          router.push(
            "https://app.bankid.com/?autostarttoken=" +
              autoStartToken +
              "&redirect=https://bankid.nytrek.dev/"
          );
          interval.current = setInterval(() => collect(), 1000);
        }
        interval.current = setInterval(
          () => Promise.all([collect(), generate()]),
          1000
        );
      }
    } catch (err: any) {
      console.log(err.message);
    }
  };
  useEffect(() => {
    if (getCookie("sign")) deleteCookie("sign");
  }, []);
  if (isLoading) return <>Loading...</>;
  return (
    <div>
      {/* Sticky search header */}
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-6 border-b border-white/5 bg-gray-900 px-4 shadow-sm sm:px-6 lg:px-8">
        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <form className="flex flex-1" action="#" method="GET">
            <label htmlFor="search-field" className="sr-only">
              Search
            </label>
            <div className="relative w-full">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-500"
                aria-hidden="true"
              />
              <input
                id="search-field"
                className="block h-full w-full border-0 bg-transparent py-0 pl-8 pr-0 text-white focus:ring-0 sm:text-sm"
                placeholder="Search..."
                type="search"
                name="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>
        </div>
      </div>

      <div className="flex flex-col-reverse lg:block">
        <main className="lg:pr-96">
          <header className="flex items-center justify-between border-b border-white/5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <h1 className="text-base font-semibold leading-7 text-white">
              Deployments
            </h1>

            <p className="text-sm font-medium leading-6 text-white">
              {signs?.length} Signature/s captured
            </p>
          </header>

          {/* Deployment list */}
          <ul role="list" className="divide-y divide-white/5">
            {signs
              ?.filter(
                (sign) =>
                  sign.orderRef.includes(search) ||
                  sign.status.includes(search) ||
                  sign.hintCode.includes(search)
              )
              .map((sign) => (
                <li
                  key={sign.id}
                  className="relative flex items-center space-x-4 px-4 py-4 sm:px-6 lg:px-8"
                >
                  <div className="min-w-0 flex-auto">
                    <div className="flex items-center gap-x-3">
                      <h2 className="min-w-0 text-sm font-semibold leading-6 text-white">
                        {sign.orderRef}
                      </h2>
                    </div>
                    <div className="mt-3 flex items-center gap-x-2.5 text-xs leading-5 text-gray-400">
                      <p className="truncate">
                        {formatDistanceToNow(new Date(sign.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                      <svg
                        viewBox="0 0 2 2"
                        className="h-0.5 w-0.5 flex-none fill-gray-300"
                      >
                        <circle cx={1} cy={1} r={1} />
                      </svg>
                      <p className="whitespace-nowrap">{sign.hintCode}</p>
                    </div>
                  </div>
                  <div
                    className={clsx(
                      environments[sign.status as keyof typeof environments],
                      "flex-none rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset"
                    )}
                  >
                    {sign.status}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteSign.mutate(sign.id)}
                  >
                    <XMarkIcon
                      className="h-5 w-5 flex-none text-gray-400"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
          </ul>
        </main>

        {/* Activity feed */}
        <aside className="bg-black/10 lg:fixed lg:bottom-0 lg:right-0 lg:top-16 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-white/5">
          <header className="flex items-center justify-between border-b border-white/5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <h2 className="text-base font-semibold leading-7 text-white">
              QR Code
            </h2>
            {data ? (
              <button
                type="button"
                onClick={reset}
                className="text-sm font-semibold leading-6 text-indigo-400"
              >
                Reset
              </button>
            ) : (
              <button
                type="button"
                onClick={initiate}
                className="text-sm font-semibold leading-6 text-indigo-400"
              >
                Start
              </button>
            )}
          </header>
          {!!data && (
            <img
              src={data}
              className="mx-auto mb-6 mt-12 rounded-md"
              alt="qrcode"
            />
          )}
          {userSign && (
            <p className="px-4 py-4 text-center font-mono text-sm text-white sm:px-6 sm:py-6 lg:px-8">
              Complete the signature process using Bank ID on your device
            </p>
          )}
          {!data && (
            <>
              <div className="px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="pno"
                    className="block text-sm font-medium leading-6 text-white"
                  >
                    Personal number
                  </label>
                </div>
                <div className="mt-2">
                  <input
                    ref={pnoRef}
                    id="pno"
                    type="text"
                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
              <div className="mb-12 px-4 sm:px-6 lg:px-8">
                <button
                  type="button"
                  onClick={initiate}
                  className="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  Open on this device
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
