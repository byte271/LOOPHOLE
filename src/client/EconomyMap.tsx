import type { Action, Model, State } from "../domain/model";
import { formatMoney } from "../domain/model";
import type { TraceStep } from "../domain/contracts";
import { ArrowUpRight, CircleDot, Maximize2 } from "lucide-react";

const locations: Record<
  Action["kind"],
  { x: number; y: number; name: string; color: string }
> = {
  buy: { x: 148, y: 145, name: "Market", color: "#de8b6c" },
  craft: { x: 470, y: 145, name: "Forge", color: "#aaa1c6" },
  reward: { x: 470, y: 365, name: "Guild", color: "#9aba9a" },
  sell: { x: 148, y: 365, name: "Exchange", color: "#dbb773" },
  convert: { x: 148, y: 365, name: "Exchange", color: "#dbb773" },
  other: { x: 310, y: 252, name: "Commons", color: "#a9bbbc" },
};
function Building({
  type,
}: {
  type: "market" | "forge" | "guild" | "exchange";
}) {
  if (type === "market")
    return (
      <g>
        <ellipse cy="34" rx="66" ry="17" fill="#ddd5c4" opacity=".55" />
        <path
          d="M-51 2 L0 -22 52 3 0 30Z"
          fill="#eee5d2"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-47 -36 V5 L0 29V-13Z"
          fill="#eadbc2"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M0 -13 47 -36V6L0 29Z"
          fill="#cebda0"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-55 -40 0 -66 55 -40 0 -13Z"
          fill="#f1b391"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-55 -40V-27L0 0V-13Z"
          fill="#d8785c"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M0 -13 55 -40V-27L0 0Z"
          fill="#f2c1a2"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-39 -47 15 -21M-22 -55 32 -29M-39 -32V-18M-22 -23V-9M17 -22V-9M35 -31V-18"
          stroke="#fff1db"
          strokeWidth="10"
        />
        <path
          d="M-55 -40 0 -13 55 -40M0 -13V0"
          fill="none"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-33 -9V4L-16 13V-1Z"
          fill="#6c8070"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M15 2V19L33 10V-7Z"
          fill="#4e5e50"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-61 15-45 7-29 15-45 23Z M-61 15V29L-45 37V23M-45 37-29 29V15"
          fill="#b9bc89"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
      </g>
    );
  if (type === "forge")
    return (
      <g>
        <ellipse cy="34" rx="65" ry="17" fill="#ddd5c4" opacity=".55" />
        <path
          d="M-46 -24 0 -48 47 -23V9L0 33-46 9Z"
          fill="#b2a8bd"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M0 0V33L47 9V-23Z"
          fill="#8e869e"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-55 -26 0 -66 55 -26 0 3Z"
          fill="#d5ccd9"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M0 -66V-48L55 -26 0 3Z"
          fill="#a79bad"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-35 -43V-75L-21 -82-7 -75V-43L-21 -36Z"
          fill="#c2b3bd"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-35 -75-21 -68-7 -75M-21 -68V-36"
          fill="none"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-33 15V-1Q-22 -20-11 10V26Z"
          fill="#4c484e"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path d="M-28 14-24 2-20 11-15 9-16 21Z" fill="#ed9672" />
        <path
          d="M15 2 36 -9V8L15 19Z"
          fill="#535958"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M39 28 59 18 69 23 50 33V43L41 47V35L28 32Z"
          fill="#7d8790"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-21 -93C-39 -103 0 -104-13 -117"
          fill="none"
          stroke="#c7c2b7"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    );
  if (type === "guild")
    return (
      <g>
        <ellipse cy="35" rx="68" ry="18" fill="#ddd5c4" opacity=".55" />
        <path
          d="M-48 -26 0 -51 48 -26V10L0 34-48 10Z"
          fill="#c6ccb1"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M0 -2 48 -26V10L0 34Z"
          fill="#98a78a"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-56 -28 0 -75 56 -28 0 1Z"
          fill="#7b9985"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M0 -75V-48L56 -28 0 1Z"
          fill="#a3b49a"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M0 -76V-106M0 -106 29 -96 0 -87Z"
          fill="#ed9c7b"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M-30 19V-7L-14 1V27Z"
          fill="#6e785e"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path
          d="M15 1 34 -9V8L25 20 15 13Z"
          fill="#e5c278"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
        <path d="M24 -2V10M20 5 28 1" stroke="#6c7056" strokeWidth="2" />
        <path
          d="M-35 24-12 36-24 42-47 30Z"
          fill="#dbdac5"
          stroke="#2f3c35"
          strokeWidth="1.5"
        />
      </g>
    );
  return (
    <g>
      <ellipse cy="35" rx="68" ry="17" fill="#ddd5c4" opacity=".55" />
      <path
        d="M-48 -30 0 -54 48 -30V12L0 36-48 12Z"
        fill="#e4d4ac"
        stroke="#2f3c35"
        strokeWidth="1.5"
      />
      <path
        d="M0 -6 48 -30V12L0 36Z"
        fill="#c6b38e"
        stroke="#2f3c35"
        strokeWidth="1.5"
      />
      <path
        d="M-57 -34 0 -63 57 -34 0 -5Z"
        fill="#f1dfb4"
        stroke="#2f3c35"
        strokeWidth="1.5"
      />
      <path
        d="M-57 -34V-26L0 3 57 -26V-34L0 -5Z"
        fill="#c6ad7d"
        stroke="#2f3c35"
        strokeWidth="1.5"
      />
      <path
        d="M-39 -17V12M-24 -9V20M-10 -2V27M11 -2V27M25 -9V20M39 -17V12"
        stroke="#f8ebcd"
        strokeWidth="7"
      />
      <path
        d="M-55 15 0 44 56 15V22L0 51-55 22Z"
        fill="#d7c298"
        stroke="#2f3c35"
        strokeWidth="1.5"
      />
      <ellipse
        cy="-34"
        rx="15"
        ry="10"
        fill="#dfb05e"
        stroke="#2f3c35"
        strokeWidth="1.5"
      />
      <path
        d="M0 -42V-26M5 -38C-12 -43-9 -31 3 -33S11 -24-5 -30"
        fill="none"
        stroke="#6e6449"
        strokeWidth="1.5"
      />
    </g>
  );
}
export function EconomyMap({
  model,
  state,
  step,
  previousStep,
  stepNumber,
  onSelectAction,
  selectedAction,
  expanded,
  onExpand,
}: {
  model: Model;
  state: State;
  step?: TraceStep;
  previousStep?: TraceStep;
  stepNumber: number;
  onSelectAction: (id: string) => void;
  selectedAction: string | null;
  expanded: boolean;
  onExpand: () => void;
}) {
  const active = model.actions.find((a) => a.id === step?.actionId);
  const previousAction = model.actions.find(
    (a) => a.id === previousStep?.actionId,
  );
  const previousPoint = previousAction
    ? locations[previousAction.kind]
    : { x: 310, y: 220 };
  const point = active
    ? locations[active.kind]
    : { x: 310, y: 250, name: "Start", color: "#f39777" };
  const stations = [
    { type: "market", kind: "buy", x: 148, y: 145, n: "01" },
    { type: "forge", kind: "craft", x: 470, y: 145, n: "02" },
    { type: "guild", kind: "reward", x: 470, y: 365, n: "03" },
    { type: "exchange", kind: "sell", x: 148, y: 365, n: "04" },
  ] as const;
  return (
    <section
      className={`map-panel ${expanded ? "expanded" : ""}`}
      aria-label="Economy visualization"
    >
      <div className="map-toolbar">
        <div className="eyebrow">
          <span className="live-dot" /> ECONOMY MAP{" "}
          <span className="muted">/ {model.actions.length} ACTIONS</span>
        </div>
        <button
          className="icon-button"
          onClick={onExpand}
          title={expanded ? "Restore map size" : "Expand map"}
          aria-label={expanded ? "Restore map size" : "Expand map"}
        >
          <Maximize2 size={15} />
        </button>
      </div>
      <svg
        className="economy-svg"
        viewBox="0 0 620 490"
        role="img"
        aria-label={`Economy locations. Recorded state ${stepNumber}: ${active?.label ?? "initial state"}. Currency ${formatMoney(state.currency, model.currency.decimals)}.`}
      >
        <defs>
          <pattern
            id="mapDots"
            x="0"
            y="0"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".8" fill="#b3b3a0" opacity=".32" />
          </pattern>
          <filter id="avatarShadow">
            <feDropShadow
              dx="0"
              dy="4"
              stdDeviation="4"
              floodColor="#2d3932"
              floodOpacity=".15"
            />
          </filter>
        </defs>
        <rect width="620" height="490" fill="url(#mapDots)" />
        <path
          d="M148 161Q310 91 470 161Q519 253 470 383Q310 434 148 383Q95 254 148 161Z"
          fill="none"
          stroke="#e3dfd1"
          strokeWidth="23"
        />
        <path
          d="M148 161Q310 91 470 161Q519 253 470 383Q310 434 148 383Q95 254 148 161Z"
          fill="none"
          stroke="#c9c7b7"
          strokeWidth="1.5"
          strokeDasharray="4 7"
        />
        <path
          d="M186 184 272 231M430 184 350 231M187 347 272 273M434 346 350 273"
          stroke="#d0cebd"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <ellipse
          cx="310"
          cy="253"
          rx="52"
          ry="29"
          fill="#ece9dd"
          stroke="#d0cebd"
        />
        <ellipse
          cx="310"
          cy="253"
          rx="41"
          ry="21"
          fill="none"
          stroke="#d0cebd"
          strokeDasharray="2 4"
        />
        <path
          d="M305 112 312 117 304 123M496 262 490 270 484 263M313 413 305 407 313 401M119 266 126 258 132 266"
          fill="none"
          stroke="#979f8d"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g
          className="map-decoration"
          stroke="#9dab92"
          strokeWidth="1.3"
          fill="none"
        >
          <path d="M65 210v-13m0 8-5-5m5 2 5-6M552 319v-13m0 8-5-5m5 2 5-6M377 444v-13m0 8-5-5m5 2 5-6M234 67v-13m0 8-5-5m5 2 5-6" />
          <circle cx="73" cy="402" r="4" />
          <circle cx="549" cy="88" r="4" />
        </g>
        {active && (
          <path
            d={`M${previousPoint.x} ${previousPoint.y + 31} Q${(previousPoint.x + point.x) / 2 + (previousPoint.x === point.x ? 55 : 0)} ${(previousPoint.y + point.y) / 2 + (previousPoint.y === point.y ? -15 : 31)} ${point.x} ${point.y + 31}`}
            fill="none"
            stroke={point.color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="2 7"
            opacity=".85"
          />
        )}
        {stations.map((s) => (
          <g
            key={s.type}
            transform={`translate(${s.x} ${s.y})`}
            opacity={
              model.actions.some(
                (a) =>
                  a.kind === s.kind ||
                  (s.kind === "sell" && a.kind === "convert"),
              )
                ? 1
                : 0.4
            }
          >
            <Building type={s.type} />
            <rect
              x="-57"
              y="59"
              width="114"
              height="28"
              rx="14"
              fill={
                active &&
                (active.kind === s.kind ||
                  (s.kind === "sell" && active.kind === "convert"))
                  ? "#263b31"
                  : "#fbfaf3"
              }
              stroke="#d6d5c7"
            />
            <text
              y="77"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={
                active &&
                (active.kind === s.kind ||
                  (s.kind === "sell" && active.kind === "convert"))
                  ? "#fffaf0"
                  : "#37453c"
              }
            >
              {s.n} · {locations[s.kind].name.toUpperCase()}
            </text>
          </g>
        ))}
        <g
          className="map-avatar"
          style={{
            transform: `translate(${point.x}px, ${point.y + (active ? 31 : -3)}px)`,
          }}
          filter="url(#avatarShadow)"
        >
          <circle r="20" fill="#fcf8ec" stroke="#263b31" strokeWidth="1.5" />
          <circle r="15" fill={point.color} />
          <path d="M-8 10V6Q-8 0 0 0T8 6V10" fill="#2e4136" />
          <circle cy="-5" r="6" fill="#fff2d5" />
          <path d="M-6-6Q-5-15 3-11L7-5Z" fill="#2e4136" />
          <circle cx="15" cy="-14" r="8" fill="#263b31" />
          <text
            x="15"
            y="-11"
            textAnchor="middle"
            fill="white"
            fontSize="8"
            fontWeight="700"
          >
            {stepNumber}
          </text>
        </g>
        {!active && (
          <text
            x="310"
            y="297"
            textAnchor="middle"
            fill="#7a8172"
            fontSize="10"
            letterSpacing="1.6"
          >
            YOUR STARTING POINT
          </text>
        )}
      </svg>
      <div className="map-caption">
        <span>
          <CircleDot size={14} />{" "}
          {step
            ? `Recorded step ${stepNumber} · ${active?.label}`
            : "Ready at the initial state"}
        </span>
        <span>Illustrative locations · exact state below</span>
      </div>
      <div className="action-palette">
        {model.actions.map((a, i) => (
          <button
            key={a.id}
            className={`action-chip ${selectedAction === a.id ? "selected" : ""}`}
            onClick={() => onSelectAction(a.id)}
          >
            <span className={`action-dot ${a.kind}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            {a.label}
            <ArrowUpRight size={12} />
          </button>
        ))}
      </div>
    </section>
  );
}
