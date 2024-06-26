import { useState } from "react";
import { useDojo } from "../../../../../DojoContext";
import { LaborBuilding } from "./LaborBuilding";
import { LaborResourceBuildPopup } from "./LaborResourceBuildPopup";
import { ChooseBuilding } from "./ChooseBuilding";
import { useBuildings } from "../../../../../hooks/helpers/useBuildings";

type LaborBuildingsPanelProps = {};

export const LaborBuildingsPanel = ({}: LaborBuildingsPanelProps) => {
  const {
    setup: {
      components: {},
    },
  } = useDojo();

  const [showPopup, setShowPopup] = useState(false);
  const { getLaborBuilding } = useBuildings();

  const [selectedLaborResource, setSelectedLaborResource] = useState<number | undefined>(undefined);

  const laborBuilding = getLaborBuilding();

  const guild = laborBuilding?.building_type;

  return guild ? (
    <div className="relative flex flex-col p-2 min-h-[120px]">
      {showPopup && selectedLaborResource && (
        <LaborResourceBuildPopup guild={guild} resourceId={selectedLaborResource} onClose={() => setShowPopup(false)} />
      )}
      <div className="flex flex-col p-2">
        <LaborBuilding
          guild={guild}
          selectedLaborResource={selectedLaborResource}
          setSelectedLaborResource={setSelectedLaborResource}
          setShowPopup={setShowPopup}
        />
      </div>
    </div>
  ) : (
    <ChooseBuilding />
  );
};
