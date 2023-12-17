import { useMemo, useState } from "react";
import { Notification } from "../elements/Notification";
import clsx from "clsx";
import Button from "../elements/Button";
import {
  EventType,
  NotificationType,
  generateUniqueId,
  useNotifications,
} from "../hooks/notifications/useNotifications";
import { useDojo } from "../DojoContext";

const MAX_HARVEST_NOTIFICATIONS = 11;

type NotificationsComponentProps = {
  className?: string;
} & React.ComponentPropsWithRef<"div">;

export const NotificationsComponent = ({ className }: NotificationsComponentProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { harvest_all_labor },
    },
  } = useDojo();

  const [showNotifications, setShowNotifications] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { notifications, handleCloseNotification, removeNotification, closedNotifications } = useNotifications();

  const onHarvestAll = async () => {
    setIsLoading(true);
    for (let notification of notifications
      .filter((notification) => notification.eventType === EventType.Harvest)
      .slice(0, MAX_HARVEST_NOTIFICATIONS)) {
      const id = generateUniqueId(notification);
      handleCloseNotification(id);
    }
    const harvestKeys: string[][] = notifications
      .map((notification: NotificationType) => {
        if (notification.eventType === EventType.Harvest) {
          return notification.keys as string[];
        }
      })
      .filter(Boolean)
      .slice(0, MAX_HARVEST_NOTIFICATIONS) as string[][];
    await harvest_all_labor({
      signer: account,
      entity_ids: harvestKeys,
    });
    for (let notification of notifications
      .filter((notification) => notification.eventType === EventType.Harvest)
      .slice(0, MAX_HARVEST_NOTIFICATIONS)) {
      const id = generateUniqueId(notification);
      removeNotification(id);
    }
    setIsLoading(false);
  };

  const hasHarvestNotification = useMemo(() => {
    return (
      notifications.filter((notification: NotificationType) => {
        return notification.eventType === EventType.Harvest;
      }).length > 0
    );
  }, [notifications]);

  // Helper function to filter unique notifications based on their keys.
  const getUniqueNotifications = (notifications: NotificationType[]): NotificationType[] => {
    const uniqueKeys = new Set<string>();
    return notifications.filter((notification) => {
      const id = generateUniqueId(notification);
      if (!uniqueKeys.has(id)) {
        uniqueKeys.add(id);
        return true;
      }
      return false;
    });
  };

  return (
    <div className={clsx("flex flex-col space-y-2 fixed right-4 bottom-4 top-4 pointer-events-none", className)}>
      <div className="w-full flex flex-cols justify-between">
        {
          <Button
            variant="primary"
            className="pointer-events-auto mr-2"
            onClick={() => setShowNotifications((prev) => !prev)}
          >
            {showNotifications ? "Hide notifications" : "Show notifications"}
          </Button>
        }
        {hasHarvestNotification && (
          <Button variant="success" className="pointer-events-auto" isLoading={isLoading} onClick={onHarvestAll}>
            {"Harvest All"}
          </Button>
        )}
      </div>
      <div className="overflow-auto">
        {showNotifications &&
          getUniqueNotifications(notifications).map((notification: NotificationType) => {
            const id = generateUniqueId(notification);

            return (
              <Notification
                closedNotifications={closedNotifications}
                notification={notification}
                key={id}
                id={id}
                onClose={() => handleCloseNotification(id)}
              ></Notification>
            );
          })}
      </div>
    </div>
  );
};
