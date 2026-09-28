// Purchase orders & delivery — the "delivery" half of the stage's name. Orders
// for every job whichever branch it took (drafted while approvals are pending,
// sent once the job may order), with each one's delivery scheduled around the
// BOQ's lead times and received on site.

import { CalendarClock, PackageCheck, Send, Truck } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import SectionHead from "@/components/SectionHead";
import StatCard from "@/components/StatCard";
import { PO_STATUSES } from "@/lib/mockData/procurement";
import {
  allDelivered,
  boqLines,
  deliveredOrders,
  longestLeadTimeDays,
  pendingApprovals,
  purchaseOrders,
  quotesReceived,
  readyToOrder,
  roleLabel,
  sentOrders,
  unavailableLines,
} from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

const lineNames = (job, keys = []) => {
  const byKey = new Map(boqLines(job).map((line) => [line.key, line.item]));
  return keys.map((key) => byKey.get(key) ?? key).join(", ");
};

export default function PurchaseOrders({ job }) {
  const orders = purchaseOrders(job);
  const sent = sentOrders(job);
  const delivered = deliveredOrders(job);
  const leadTime = longestLeadTimeDays(job);
  const backordered = unavailableLines(job);

  if (!quotesReceived(job)) {
    return (
      <Alert tone="info">
        Purchase orders are raised once every line is quoted and any price variation has been approved. Nothing to order yet.
      </Alert>
    );
  }

  return (
    <>
      {!readyToOrder(job) ? (
        <Alert tone="warning">
          {orders.length ? `${orders.length} order${orders.length === 1 ? "" : "s"} drafted and` : "Orders are"} held until{" "}
          {pendingApprovals(job).map(roleLabel).join(" and ")} approve{pendingApprovals(job).length === 1 ? "s" : ""} the
          price variation.
        </Alert>
      ) : sent.length === 0 ? (
        <Alert tone="info">Cleared to order — procurement can start sending purchase orders. Each one is recorded in the history tab.</Alert>
      ) : allDelivered(job) ? (
        <Alert tone="success">Every order has been received on site — materials are ready for the construction crew.</Alert>
      ) : (
        <Alert tone="info">
          {delivered.length} of {sent.length} orders received. Deliveries are scheduled with the site coordinator so the crew
          is not waiting on stock.
        </Alert>
      )}

      <div className="stats" style={{ margin: "20px 0" }}>
        <StatCard label="Orders sent" value={`${sent.length} / ${orders.length}`} icon={<Send size={14} />} hint="Of those drafted" />
        <StatCard label="Received on site" value={delivered.length} icon={<PackageCheck size={14} />} hint="Deliveries signed for" />
        <StatCard
          label="Longest lead time"
          value={leadTime ? `${leadTime} days` : "None"}
          icon={<CalendarClock size={14} />}
          hint={backordered.length ? `${backordered.map((line) => line.item).join(", ")} on back-order` : "Everything can be had when ordered"}
        />
      </div>

      <SectionHead icon={<Truck size={13} />} title="Purchase orders" />
      {orders.length === 0 ? (
        <p className="lede" style={{ fontSize: 14 }}>
          None drafted yet.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Supplier</th>
                <th>Total</th>
                <th>Sent</th>
                <th>Delivery</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const status = PO_STATUSES[order.status] ?? PO_STATUSES.draft;
                return (
                  <tr key={order.number}>
                    <td>
                      <div className="row-title">{order.number}</div>
                      <div className="row-meta" style={{ whiteSpace: "normal" }}>
                        {lineNames(job, order.lines)}
                      </div>
                    </td>
                    <td>{order.supplier}</td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>{order.sentAt ? formatDate(order.sentAt) : <span className="row-meta">not yet</span>}</td>
                    <td>
                      {order.deliveredAt ? (
                        <>
                          <div>{formatDate(order.deliveredAt)}</div>
                          <div className="row-meta">received by {order.receivedBy}</div>
                        </>
                      ) : order.scheduledFor ? (
                        <>
                          <div>{formatDate(order.scheduledFor)}</div>
                          <div className="row-meta">scheduled</div>
                        </>
                      ) : order.deliveryEta ? (
                        <>
                          <div>{formatDate(order.deliveryEta)}</div>
                          <div className="row-meta">supplier ETA</div>
                        </>
                      ) : (
                        <span className="row-meta">—</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
