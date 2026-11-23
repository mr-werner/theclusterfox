import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BadgeDollarSign, ListChecks, PiggyBank, Store, Ticket } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useAuth } from "../../context/AuthContext";
import { useGroceryData } from "./state/useGroceryData";
import { usePrices } from "./state/usePrices";
import { compareList, itemsToPrice } from "./model/compare";
import { COOK_KEY, newCookItems, readCook } from "./model/cookLink";
import { localDay } from "./model/spending";
import ListTab from "./components/ListTab";
import StoresTab from "./components/StoresTab";
import PricesTab from "./components/PricesTab";
import CouponsTab from "./components/CouponsTab";
import SpendingTab from "./components/SpendingTab";
import "./grocery.css";
import "./identity.css";

const TABS = [
  { id: "list", name: "List", icon: ListChecks },
  { id: "stores", name: "Stores", icon: Store },
  { id: "prices", name: "Prices", icon: BadgeDollarSign },
  { id: "coupons", name: "Coupons", icon: Ticket },
  { id: "spending", name: "Spending", icon: PiggyBank },
];

const SYNC_TEXT = { synced: "Saved to your account", syncing: "Saving…", error: "Couldn't reach your account; saved on this device" };

// GroceryFox: a grocery list that knows what things cost at the stores near
// you, which coupons you have, and how the month's budget is going.
export default function GroceryPage() {
  const { data, change, setList, syncStatus } = useGroceryData();
  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : "list";
  const go = id => setParams(id === "list" ? {} : { tab: id }, { replace: false });
  const today = localDay();

  // CookFox's recipe list, read fresh whenever this tab comes back into view.
  const [cookRaw, setCookRaw] = useState(() => readCook());
  useEffect(() => {
    const refresh = () => setCookRaw(readCook());
    const onStorage = e => e.key === COOK_KEY && refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const cookPending = useMemo(() => newCookItems(cookRaw, data.list), [cookRaw, data.list]);

  const items = useMemo(() => itemsToPrice(data.list), [data.list]);
  const { features, live, waitingFor } = usePrices(data.place, data.stores, items);
  const prices = useMemo(() => ({ typed: data.typed, live, chosen: data.chosen }), [data.typed, live, data.chosen]);
  const result = useMemo(() => compareList(data.list, data.stores, prices, data.coupons, today), [data.list, data.stores, prices, data.coupons, today]);

  const shared = { data, change, setList, today, result, items, live, features, waitingFor, go };
  const listCount = data.list.filter(i => !i.checked).length;

  return (
    <div className="gx">
      <AppBar appId="groceryfox" planTitle="Grocery run" />
      <main className="gx-wrap">
        <nav className="gx-tabs" aria-label="GroceryFox">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
                <Icon size={17} aria-hidden="true" />
                <span className="gx-tab-name">{t.name}</span>
                {t.id === "list" && listCount > 0 && <span className="gx-tab-count">{listCount}</span>}
              </button>
            );
          })}
        </nav>

        {tab === "list" && <ListTab {...shared} cookPending={cookPending} fromCook={params.get("from") === "cookfox"} />}
        {tab === "stores" && <StoresTab {...shared} />}
        {tab === "prices" && <PricesTab {...shared} />}
        {tab === "coupons" && <CouponsTab {...shared} />}
        {tab === "spending" && <SpendingTab {...shared} />}

        <p className="gx-foot">
          {isAuthenticated && SYNC_TEXT[syncStatus] ? SYNC_TEXT[syncStatus] : "Your list, prices and coupons are saved on this device."} Prices change often; check before you go.
        </p>
      </main>
    </div>
  );
}
