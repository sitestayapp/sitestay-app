import { Button } from "@/components/ui/button";
import { Plane, ArrowRight, Clock } from "lucide-react";

export type FlightOption = {
  id?: string;
  airline: string;
  airline_logo?: string | null;
  origin: string;
  destination: string;
  depart_time?: string;
  arrive_time?: string;
  duration?: string;
  stops?: number;
  return_depart_time?: string | null;
  return_arrive_time?: string | null;
  return_duration?: string | null;
  return_stops?: number | null;
  price_total?: number | null;
  price_label?: string | null;
  currency?: string;
  date?: string;
  return_date?: string | null;
  url?: string | null;
};

function Leg({ from, to, dep, arr, dur, stops }: { from: string; to: string; dep?: string; arr?: string; dur?: string; stops?: number | null }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-center">
        <div className="font-display font-bold">{dep || "--:--"}</div>
        <div className="text-[10px] text-muted-foreground">{from}</div>
      </div>
      <div className="flex-1 flex flex-col items-center">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{dur || "—"}</div>
        <div className="w-full h-px bg-border my-1 relative"><Plane className="h-3 w-3 text-primary absolute -top-1.5 right-0" /></div>
        <div className="text-[10px] text-muted-foreground">{stops === 0 ? "Directo" : `${stops} escala${(stops ?? 0) > 1 ? "s" : ""}`}</div>
      </div>
      <div className="text-center">
        <div className="font-display font-bold">{arr || "--:--"}</div>
        <div className="text-[10px] text-muted-foreground">{to}</div>
      </div>
    </div>
  );
}

export default function FlightCard({
  option, index, onChoose, disabled,
}: { option: FlightOption; index: number; onChoose: (o: FlightOption, i: number) => void; disabled?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-elegant transition-all p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {option.airline_logo ? (
            <img src={option.airline_logo} alt={option.airline} className="h-6 w-6 object-contain" />
          ) : <Plane className="h-5 w-5 text-primary" />}
          <span className="font-medium text-sm">{option.airline}</span>
          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full text-white bg-primary">VUELO</span>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-bold text-primary leading-none">
            {option.price_label ?? (option.price_total ? `${Math.round(option.price_total)} €` : "—")}
          </div>
          <div className="text-[11px] text-muted-foreground">{option.return_date ? "ida + vuelta" : "ida"}</div>
        </div>
      </div>
      <div className="grid gap-3">
        <Leg from={option.origin} to={option.destination} dep={option.depart_time} arr={option.arrive_time} dur={option.duration} stops={option.stops ?? 0} />
        {option.return_depart_time && (
          <>
            <div className="border-t border-border" />
            <Leg from={option.destination} to={option.origin} dep={option.return_depart_time ?? ""} arr={option.return_arrive_time ?? ""} dur={option.return_duration ?? ""} stops={option.return_stops ?? 0} />
          </>
        )}
      </div>
      <div className="mt-3 pt-2 flex items-center justify-end">
        <Button size="sm" disabled={disabled} onClick={() => onChoose(option, index)} className="bg-primary hover:bg-primary/90">
          Elegir este vuelo
        </Button>
      </div>
    </div>
  );
}