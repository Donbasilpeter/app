import clx from "classnames";
import { FC } from "react";
import { useSunriseStake } from "../context/sunriseStakeContext";
import { toFixedWithPrecision, toSol, ZERO } from "../lib/util";
import BN from "bn.js";
import { Disclosure, Transition } from "@headlessui/react";
import { ChevronUpIcon } from "@heroicons/react/20/solid";

interface DetailEntryProps {
  label: string;
  value: string;
  share?: number;
}
const DetailEntry: FC<DetailEntryProps> = ({ label, value, share }) => (
  <div className="flex flex-row justify-between">
    <div className="text-gray-100 text-sm sm:text-lg">{label}</div>
    <div className="font-bold text-sm sm:text-lg">
      {value} <span className="text-bold text-xs">SOL</span>{" "}
      {share !== undefined && (
        <span className="hidden sm:inline text-gray-300 font-normal text-sm">
          ({share}%)
        </span>
      )}
    </div>
  </div>
);

interface Props {
  className?: string;
}
const DetailsBox: FC<Props> = ({ className }) => {
  const { details } = useSunriseStake();

  if (!details) return <>Loading...</>;

  const inflightTotal = details.inflight.reduce(
    (acc, x) => acc.add(x.totalOrderedLamports),
    ZERO
  );

  const totalValue = details.mpDetails.msolValue
    .add(details.lpDetails.lpSolValue)
    .add(details.bpDetails.bsolValue)
    .add(inflightTotal);

  const mpShare =
    details.mpDetails.msolValue.muln(10_000).div(totalValue).toNumber() / 100;
  const bpShare =
    details.bpDetails.bsolValue.muln(10_000).div(totalValue).toNumber() / 100;
  const lpShare =
    details.lpDetails.lpSolValue.muln(10_000).div(totalValue).toNumber() / 100;
  const inflightShare =
    inflightTotal.muln(10_000).div(totalValue).toNumber() / 100;

  const extractableYield = new BN(
    Math.max(details.extractableYield.toNumber(), 0)
  );
  const yieldShare =
    extractableYield.muln(10_000).div(totalValue).toNumber() / 100;
  const gSolSupply = new BN(details.balances.gsolSupply.amount);

  const lamportsToDisplay = (lamports: BN): string =>
    toFixedWithPrecision(toSol(lamports), 2);

  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button
            className={clx(
              "flex w-full justify-between rounded-t-md bg-green-light/30 backdrop-blur-md px-4 py-1 text-left text-sm font-medium text-white hover:brightness-150",
              {
                "rounded-t-md border border-green-light": open,
                "rounded-md": !open,
              }
            )}
          >
            <span>Details</span>
            <ChevronUpIcon
              className={clx("h-5 w-5 text-white", {
                "rotate-180 transform": open,
              })}
            />
          </Disclosure.Button>
          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Disclosure.Panel>
              <div
                className={clx(
                  "bg-green-light/30 border-x border-b border-green-light backdrop-blur-md py-2 px-4 rounded-b-md text-center",
                  className
                )}
              >
                <DetailEntry
                  label="Total gSOL"
                  value={lamportsToDisplay(gSolSupply)}
                  share={100}
                />
                <DetailEntry
                  label="Marinade Stake Pool Value"
                  value={lamportsToDisplay(details.mpDetails.msolValue)}
                  share={mpShare}
                />
                <DetailEntry
                  label="Marinade Liquidity Pool Value"
                  value={lamportsToDisplay(details.lpDetails.lpSolValue)}
                  share={lpShare}
                />
                <DetailEntry
                  label="SolBlaze Stake Pool Value"
                  value={lamportsToDisplay(details.bpDetails.bsolValue)}
                  share={bpShare}
                />
                <DetailEntry
                  label="In-flight Value"
                  value={lamportsToDisplay(inflightTotal)}
                  share={inflightShare}
                />
                <DetailEntry
                  label="Extractable Yield"
                  value={lamportsToDisplay(extractableYield)}
                  share={yieldShare}
                />
              </div>
            </Disclosure.Panel>
          </Transition>{" "}
        </>
      )}
    </Disclosure>
  );
};

export { DetailsBox };
