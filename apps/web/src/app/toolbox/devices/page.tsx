import type { Metadata } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";
import { Badge } from "@hataraku/ui/components/badge";
import { Smartphone } from "@hataraku/ui/icons";

import { MediaImage } from "#src/components/media-image.tsx";
import { ToolboxSection } from "#src/components/toolbox-section.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * The device shelf: the machines the site runs on, with the specs the owner recorded.
 *
 * Devices are short by nature, so the section reads one generous page rather than paginating a list
 * that will never reach a second one.
 */

export const metadata: Metadata = {
  description: "手边的机器，连同它们的规格。",
  title: "设备",
};

const PAGE_SIZE = 100;

const CATEGORY_LABELS = new Map([
  ["gear", "装备"],
  ["network", "网络设备"],
  ["phone", "手机"],
]);

const STATUS_LABELS = new Map([
  ["active", "在用"],
  ["archived", "退役"],
]);

type Device = Awaited<
  ReturnType<typeof serverCall.media.devices.list>
>["items"][number];

const specEntries = (
  specs: Record<string, string> | null
): { label: string; value: string }[] => {
  if (specs === null) {
    return [];
  }

  const entries = Object.entries(specs);

  const [first] = entries;

  if (first !== undefined && entries.length === 1 && first[0] === "raw") {
    return [{ label: "规格", value: first[1] }];
  }

  return entries.map(([label, value]) => ({ label, value }));
};

const DeviceCard = ({ device }: { device: Device }) => {
  const specs = specEntries(device.specs);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border">
      <div className="bg-muted relative aspect-video overflow-hidden border-b">
        <MediaImage
          alt={`${device.name} 的照片`}
          assetKey={device.imageKey}
          className="object-cover"
          fill
        />
        {device.imageKey === null ? (
          <span
            aria-hidden="true"
            className="text-muted-foreground absolute inset-0 flex items-center justify-center"
          >
            <Smartphone className="size-8" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-medium">{device.name}</h2>
          <span className="flex shrink-0 gap-1">
            <Badge variant="outline">
              {CATEGORY_LABELS.get(device.category) ?? device.category}
            </Badge>
            <Badge variant="secondary">
              {STATUS_LABELS.get(device.status) ?? device.status}
            </Badge>
          </span>
        </div>

        {device.brand === null ? null : (
          <p className="text-muted-foreground text-xs">{device.brand}</p>
        )}
        {device.description === null ? null : (
          <p className="text-muted-foreground text-sm">{device.description}</p>
        )}

        {specs.length === 0 ? null : (
          <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {specs.map((spec) => (
              <div className="contents" key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {device.link === null ? null : (
          <a
            className={`${focusRing} mt-auto text-sm underline underline-offset-4`}
            href={device.link}
            rel="noopener noreferrer"
            target="_blank"
          >
            了解更多
          </a>
        )}
      </div>
    </article>
  );
};

const DevicesPage = async () => {
  const devices = await serverCall.media.devices.list({
    page: 1,
    pageSize: PAGE_SIZE,
  });

  return (
    <ToolboxSection
      count={`共 ${devices.total} 台设备`}
      description="手边的机器，连同它们的规格。"
      empty={
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          还没有设备记录。整理好手上在用的机器后，会在这里列出它们的规格——先去{" "}
          <Link className={`${focusRing} underline`} href="/about">
            关于
          </Link>{" "}
          了解这个站点。
        </p>
      }
      hasItems={devices.items.length > 0}
      title="设备"
    >
      <ul className="grid gap-4 sm:grid-cols-2" data-slot="device-list">
        {devices.items.map((device) => (
          <li key={device.id}>
            <DeviceCard device={device} />
          </li>
        ))}
      </ul>
    </ToolboxSection>
  );
};

export default DevicesPage;
