import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { Headline } from "../../../../elements/Headline";
import { ReactComponent as DonkeyIcon } from "@/assets/icons/units/donkey-circle.svg";
import { ResourceCost } from "../../../../elements/ResourceCost";
import { NumberInput } from "../../../../elements/NumberInput";
import {
  findResourceById,
  PurchaseLaborProps,
  BuildLaborProps,
  Resource,
  Guilds,
  resourcesByGuild,
  getIconResourceId,
} from "@bibliothecadao/eternum";
import { ReactComponent as FishingVillages } from "@/assets/icons/resources/FishingVillages.svg";
import { ReactComponent as Farms } from "@/assets/icons/resources/Farms.svg";
import { ResourceIcon } from "../../../../elements/ResourceIcon";
import { BuildingsCount } from "../../../../elements/BuildingsCount";
import clsx from "clsx";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../hooks/context/DojoContext";
import { formatSecondsLeftInDaysHours } from "./laborUtils";
import { soundSelector, usePlayResourceSound, useUiSounds } from "../../../../../hooks/useUISound";
import { getComponentValue } from "@dojoengine/recs";
import { divideByPrecision, getEntityIdFromKeys, getPosition, getZone } from "../../../../utils/utils";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { useLabor } from "../../../../../hooks/helpers/useLabor";
import { LaborAuction } from "./LaborAuction";
import { LABOR_CONFIG } from "@bibliothecadao/eternum";
import Toggle from "../../../../elements/Toggle";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { useBuildings } from "../../../../../hooks/helpers/useBuildings";
import { BuildingLevel } from "../buildings/labor/BuildingLevel";
import BlurryLoadingImage from "../../../../elements/BlurryLoadingImage";

type LaborBuildPopupProps = {
  resourceId: number;
  setBuildLoadingStates: (prevStates: any) => void;
  onClose: () => void;
};

export const LaborBuildPopup = ({ resourceId, onClose }: LaborBuildPopupProps) => {
  const {
    setup: {
      components: { Resource, Labor },
      systemCalls: { purchase_and_build_labor, build_labor },
      optimisticSystemCalls: { optimisticBuildLabor },
    },
    account: { account },
  } = useDojo();

  const [missingResources, setMissingResources] = useState<Resource[]>([]);
  const [laborAmount, setLaborAmount] = useState(6);
  const [multiplier, setMultiplier] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [withLabor, setWithLabor] = useState(false);

  const setTooltip = useUIStore((state) => state.setTooltip);
  const { play: playLabor } = useUiSounds(soundSelector.buildLabor);

  useEffect(() => {
    setMultiplier(1); // Reset the multiplier to 1 when the resourceId changes
  }, [resourceId]);

  const onMultiplierChange = (value: number) => {
    if (resourceId === 254) {
      setMultiplier(Math.min(value, realm?.rivers || 0));
    } else {
      setMultiplier(Math.min(value, realm?.harbors || 0));
    }
  };

  let { realmEntityId, realmId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const isFood = useMemo(() => [254, 255].includes(resourceId), [resourceId]);
  const laborUnits = useMemo(() => (isFood ? 12 : laborAmount), [laborAmount]);
  const resourceInfo = useMemo(() => findResourceById(resourceId), [resourceId]);

  const { getLaborCost, getLaborAuctionAverageCoefficient } = useLabor();

  const labor = getComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]));
  const hasLaborLeft = useMemo(() => {
    if (nextBlockTimestamp && labor && labor.balance > nextBlockTimestamp) {
      return true;
    }
    return false;
  }, [nextBlockTimestamp, labor]);

  const position = realmId ? getPosition(realmId) : undefined;
  const zone = position ? getZone(position.x) : undefined;

  const laborAuctionAverageCoefficient = useMemo(() => {
    let coefficient = zone ? getLaborAuctionAverageCoefficient(zone, laborUnits * multiplier) : undefined;
    return coefficient || 1;
  }, [zone, laborUnits, multiplier]);

  const { getLaborBuilding } = useBuildings();
  const laborBuilding = getLaborBuilding();
  const guild = laborBuilding?.building_type;
  const guildLevel = Number(laborBuilding?.level || 0);
  const guildDiscount = useMemo(() => {
    if (guild && resourcesByGuild[Guilds[guild - 1]].includes(resourceId)) {
      return 0.9 ** guildLevel;
    } else {
      return 1;
    }
  }, [guildLevel, resourceId]);

  const costResources = useMemo(() => {
    if (withLabor) {
      return [
        {
          resourceId: resourceId + 28,
          amount: 1,
        },
      ];
    } else {
      return getLaborCost(resourceId);
    }
  }, [resourceId, guild, withLabor]);

  const getTotalAmount = (
    amount: number,
    isFood: boolean,
    multiplier: number,
    laborAmount: number,
    totalDiscount: number,
  ) => {
    return amount * multiplier * (isFood ? 12 : laborAmount) * totalDiscount;
  };

  const buildLabor = async ({
    entity_id,
    resource_type,
    labor_units,
    multiplier,
  }: PurchaseLaborProps & BuildLaborProps) => {
    await purchase_and_build_labor({
      signer: account,
      entity_id,
      resource_type,
      labor_units,
      multiplier,
    });
  };

  useEffect(() => {
    let missingResources: Resource[] = [];
    costResources.forEach(({ resourceId, amount }) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      );
      let missingAmount =
        Number(realmResource?.balance || 0) -
        (!withLabor
          ? getTotalAmount(
              Number(amount),
              isFood,
              multiplier,
              laborAmount,
              laborAuctionAverageCoefficient * guildDiscount,
            )
          : amount * laborAmount);
      if (missingAmount < 0) {
        missingResources.push({
          resourceId,
          amount: missingAmount,
        });
      }
    });
    setMissingResources(missingResources);
  }, [laborAmount, multiplier, costResources]);

  const onBuild = async () => {
    setIsLoading(true);
    !withLabor
      ? optimisticBuildLabor(
          nextBlockTimestamp || 0,
          costResources,
          laborAuctionAverageCoefficient,
          buildLabor,
        )({
          signer: account,
          entity_id: realmEntityId,
          resource_type: resourceId,
          labor_units: laborUnits,
          multiplier,
        })
      : await build_labor({
          entity_id: realmEntityId,
          resource_type: resourceId,
          labor_units: laborUnits,
          multiplier,
          signer: account,
        }),
      playLabor();
    setIsLoading(false);
    onClose();
  };

  return (
    <SecondaryPopup name="labor">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Build Labor:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body withWrapper width={"376px"} height={"480px"}>
        <div className="flex flex-col items-center h-[400px] p-2">
          <Headline>Produce More {resourceInfo?.trait}</Headline>
          <div className="relative flex justify-between w-full mt-1 text-xs text-lightest">
            <div className="flex items-center">
              {!isFood && (
                <>
                  <ResourceIcon className="mr-1" resource={resourceInfo?.trait || ""} size="md" /> {resourceInfo?.trait}
                </>
              )}
              {resourceId === 254 && (
                <div className="flex items-center">
                  <Farms className="mr-1" />
                  <span className="mr-1 font-bold">{`${multiplier}/${realm?.rivers || 0}`}</span> Farms
                </div>
              )}
              {resourceId === 255 && (
                <div className="flex items-center">
                  {/* // DISCUSS: can only be 0, because that is when you can build */}
                  <FishingVillages className="mr-1" />
                  <span className="mr-1 font-bold">{`${multiplier}/${realm?.harbors || 0}`}</span> Fishing Villages
                </div>
              )}
            </div>
            <div className="flex items-center">
              {`+${isFood ? divideByPrecision(LABOR_CONFIG.base_food_per_cycle * multiplier) / 2 : ""}${
                isFood ? "" : divideByPrecision(LABOR_CONFIG.base_resources_per_cycle) / 2
              }`}
              <ResourceIcon
                containerClassName="mx-0.5"
                className="!w-[12px]"
                resource={findResourceById(resourceId)?.trait as any}
                size="xs"
              />
              /h
            </div>
            <div
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap z-40">Use Balance Labor</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => {
                setTooltip(null);
              }}
            >
              <Toggle label="" checked={withLabor} onChange={() => setWithLabor(!withLabor)}>
                <DonkeyIcon />
              </Toggle>
            </div>
          </div>
          {isFood && (
            <BuildingsCount
              count={multiplier}
              // note: need to limit to 4 because of temp gas limit
              maxCount={resourceId === 254 ? realm?.rivers || 0 : realm?.harbors || 0}
              className="mt-2"
            />
          )}
          <div className={clsx("relative w-full", isFood ? "mt-2" : "mt-2")}>
            {resourceId === 254 && (
              <img src={`/images/buildings/farm.png`} className="object-cover w-full h-full rounded-[10px] h-[340px]" />
            )}
            {resourceId === 255 && (
              <img
                src={`/images/buildings/fishing_village.png`}
                className="object-cover w-full h-full rounded-[10px] h-[340px]"
              />
            )}
            {!isFood && (
              <BlurryLoadingImage
                src={`/images/resource_buildings/${resourceId}.png`}
                height="340px"
                width="100%"
                blurhash="LBHLO~W9x.F^Atoy%2Ri~TA0Myxt"
                imageStyleClass="object-cover rounded-[10px]"
              ></BlurryLoadingImage>
            )}
            <div className="absolute top-2 left-2 bg-black/90 rounded-[10px] p-3 pb-6 hover:bg-black">
              <LaborAuction />
              {guildDiscount !== 1 && <BuildingLevel className="mt-6" />}
            </div>
            <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/90">
              <div className="mb-1 ml-1 italic text-light-pink text-xxs">Cost of Production:</div>
              <div className="grid grid-cols-4 gap-2">
                {costResources.map(({ resourceId, amount }) => {
                  const missingResource = missingResources.find((resource) => resource.resourceId === resourceId);
                  const finalAmount = !withLabor
                    ? divideByPrecision(
                        getTotalAmount(
                          Number(amount),
                          isFood,
                          multiplier,
                          laborAmount,
                          laborAuctionAverageCoefficient * guildDiscount,
                        ),
                      )
                    : amount * laborAmount;
                  return (
                    <ResourceCost
                      isLabor={withLabor}
                      withTooltip
                      key={resourceId}
                      type="vertical"
                      resourceId={getIconResourceId(resourceId, withLabor)}
                      className={missingResource ? "text-order-giants" : ""}
                      amount={finalAmount}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between h-[40px] m-2 text-xxs">
          {!isFood && (
            <div className="flex items-center">
              {/* <div className="italic text-light-pink">Units</div> */}
              {/* note: max 76 for now because of gas, can remove after new contract deployment */}
              <NumberInput className="ml-2 mr-2" value={laborAmount} step={5} onChange={setLaborAmount} max={76} />
              <div className="italic text-gold">
                Creates labor for: <br />
                {formatSecondsLeftInDaysHours(
                  laborAmount * divideByPrecision(LABOR_CONFIG?.base_labor_units * 1000 || 0),
                )}
              </div>
            </div>
          )}
          {isFood && (
            <div className="flex items-center">
              <div className="italic text-light-pink">Amount</div>
              <NumberInput
                className="ml-2 mr-2"
                value={multiplier}
                onChange={onMultiplierChange}
                max={resourceId === 254 ? realm?.rivers || 0 : realm?.harbors || 0}
              />
              <div className="italic text-gold">
                <Button
                  variant="outline"
                  onClick={() => setMultiplier(resourceId === 254 ? realm?.rivers || 0 : realm?.harbors || 0)}
                >
                  Max {resourceId === 254 ? realm?.rivers || 0 : realm?.harbors || 0}
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-col items-center justify-center">
            <Button
              isLoading={isLoading}
              disabled={missingResources.length > 0 || (isFood && hasLaborLeft)}
              onClick={onBuild}
              variant="primary"
              withoutSound
            >
              {`${!withLabor ? "Purchase & " : ""}Build`}
            </Button>
            {missingResources.length > 0 && <div className="text-xxs text-order-giants/70">Insufficient resources</div>}
            {isFood && hasLaborLeft && <div className="text-xxs text-order-giants/70">Finish 24h cycle</div>}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};