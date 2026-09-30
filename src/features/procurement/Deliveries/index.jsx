// The deliveries on a job, as the purchase-order record has them — shown above
// the material-receipt checklist (CL-14) so the coordinator checks what
// arrived against what was ordered.

import { PackageCheck } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import SectionHead from "@/components/SectionHead";
import { PO_STATUSES } from "@/lib/mockData/procurement";
import { allDelivered, boqLines, deliveredOrders, sentOrders } from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";

const lineNames = (job, keys = []) => {
  const byKey = new Map(boqLines(job).map((line) => [line.key, line.item]));
  return keys.map((key) => byKey.get(key) ?? key).join(", ");
};

export default function Deliveries({ job }) {
  const sent = sentOrders(job);
  const delivered = deliveredOrders(job);

  return (
    <div style={{ marginBottom: 20 }}>
      {sent.length === 0 ? (
        <Alert tone="info">Nothing to receive yet — no purchase order has gone to a supplier. The checklist below is worked as deliveries arrive.</Alert>
      ) : allDelivered(job) ? (
        <Alert tone="success">Every order has been received on site — check it against the purchase orders below.</Alert>
      ) : (
        <Alert tone="info">
          {delivered.length} of {sent.length} orders received so far.
        </Alert>
      )}
      <SectionHead icon={<PackageCheck size={13} />} title="Deliveries" />
      {sent.length === 0 ? (
        <p className="lede" style={{ fontSize: 14 }}>
          None yet.
        </p>
      ) : (
        <div className="list-stack">
          {sent.map((order) => {
            const status = PO_STATUSES[order.status] ?? PO_STATUSES.sent;
            return (
              <div className="list-row" key={order.number}>
                <div style={{ minWidth: 0 }}>
                  <div className="row-title">
                    {order.number} · {order.supplier}
                  </div>
                  <div className="row-meta" style={{ whiteSpace: "normal" }}>
                    {lineNames(job, order.lines)}
                    {order.deliveredAt ? ` · received ${formatDate(order.deliveredAt)} by ${order.receivedBy}` : order.scheduledFor ? ` · scheduled ${formatDate(order.scheduledFor)}` : ""}
                  </div>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
