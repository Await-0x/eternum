import clsx from "clsx";
import React from "react";
import Draggable from "react-draggable";

type FilterPopupProps = {
  children: React.ReactNode;
  className?: string;
};

export const SecondaryPopup = ({ children, className }: FilterPopupProps) => {
  const nodeRef = React.useRef(null);
  return (
    <Draggable nodeRef={nodeRef}>
      <div ref={nodeRef} className={clsx("fixed z-50 flex flex-col translate-x-6 top-[200px] left-[450px]", className)}>
        {children}
      </div>
    </Draggable>
  );
};

SecondaryPopup.Head = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xxs relative -mb-[1px] z-10 bg-brown px-1 py-0.5 rounded-t-[4px] border-t border-x border-white text-white w-min whitespace-nowrap">
    {" "}
    {children}{" "}
  </div>
);

SecondaryPopup.Body = ({ width = null, children }: { width?: string | null; children: React.ReactNode }) => (
  <div
    className={`${
      width ? "" : "min-w-[438px]"
    } relative z-0 bg-gray border flex flex-col border-white rounded-tr-[4px] rounded-b-[4px]`}
    style={{ width: width ? width : "" }}
  >
    {children}
  </div>
);
