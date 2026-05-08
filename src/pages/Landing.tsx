import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Building2, Receipt, MessageSquare, Car, Plane, BarChart3, Search, Send, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 sticky top-0 z-30 bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="tracking-tight">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link to="/register">Get started <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="container py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
              <Sparkles className="h-3 w-3 text-primary" />
              Agente de IA NomadDesk
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] mb-6">
              Reservas de alojamiento corporativo, <span className="text-primary">resueltas en un chat.</span>
            </h1>
            <p className="text-base md:text-lg font-semibold text-foreground/80 mb-4 tracking-wide">
              Apartamentos · Hoteles · Coches · Vuelos
            </p>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
              SiteStayApp gestiona alojamiento, transporte y vuelos para tus equipos móviles. Factura corporativa siempre, búsqueda automática y mensaje listo para el trabajador.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild className="bg-primary hover:bg-primary/90 shadow-elegant">
                <Link to="/register">Get started <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* SERVICIOS */}
        <section className="container pb-16">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">Todo el viaje, en un solo chat</h2>
            <p className="text-muted-foreground">Cuatro servicios integrados para que tus equipos lleguen donde haga falta sin fricción.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Building2, title: "Apartamentos y hoteles", desc: "Busca y compara alojamiento en Booking y Airbnb. Cocina, lavadora, factura corporativa automática." },
              { icon: Car, title: "Alquiler de coches", desc: "Reserva vehículos para tus equipos en cualquier ciudad. Recogida y devolución flexible." },
              { icon: Plane, title: "Vuelos", desc: "Encuentra los mejores vuelos ida y vuelta. Directos o con una escala, al mejor precio." },
              { icon: BarChart3, title: "Control de gastos", desc: "Panel centralizado con todos los gastos por ciudad, trabajador y proyecto. Exporta informes en CSV." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-elegant hover:-translate-y-0.5 transition-all">
                <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="container py-16 border-t border-border/60">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">Cómo funciona</h2>
            <p className="text-muted-foreground">De petición a reserva confirmada, en menos de un minuto.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: MessageSquare, n: "01", title: "Pide en lenguaje natural", desc: "Indica ciudad, fechas, presupuesto y si necesitas coche o vuelo." },
              { icon: Search, n: "02", title: "El agente busca en paralelo", desc: "Booking, Airbnb, coches y vuelos simultáneamente. Las mejores opciones en segundos." },
              { icon: Send, n: "03", title: "Confirmación y email automático", desc: "El trabajador recibe el detalle por email. Factura corporativa siempre incluida." },
            ].map(({ icon: Icon, n, title, desc }) => (
              <div key={n} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-display text-2xl font-bold text-muted-foreground/40">{n}</span>
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section className="container py-16 border-t border-border/60">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-10">Por qué SiteStayApp</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: MessageSquare, title: "Chat con NomadDesk", desc: "Pídelo en lenguaje natural: ciudad, fechas, presupuesto. Listo." },
              { icon: Building2, title: "Apartamento u hotel", desc: "Filtros por equipamiento, valoración mínima 8/10 y cancelación." },
              { icon: Receipt, title: "Factura corporativa", desc: "Solicitada en cada reserva, automáticamente." },
              { icon: Car, title: "Alquiler de coches integrado", desc: "El mismo chat gestiona también los coches. Sin cambiar de plataforma." },
              { icon: Plane, title: "Vuelos corporativos", desc: "Busca vuelos ida y vuelta para tus equipos. Cards visuales con precio, duración y escalas." },
              { icon: CheckCircle2, title: "Email al trabajador", desc: "Confirmación automática con todos los detalles del viaje." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-elegant transition-all">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRECIOS */}
        <section className="container py-16 border-t border-border/60">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-8">Planes</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Starter", price: "3-5%", unit: "por reserva", desc: "Sin cuota mensual." },
              { name: "Business", price: "299€", unit: "/ mes", desc: "Hasta 30 empleados.", featured: true },
              { name: "Enterprise", price: "499€", unit: "/ mes", desc: "Empleados ilimitados." },
            ].map((p) => (
              <div key={p.name} className={`rounded-2xl border p-6 ${p.featured ? "bg-gradient-hero text-primary-foreground border-transparent shadow-elegant" : "bg-card border-border"}`}>
                <div className="font-display text-lg font-semibold mb-2">{p.name}</div>
                <div className="font-display text-4xl font-bold mb-1">{p.price}<span className="text-base font-normal opacity-70"> {p.unit}</span></div>
                <p className={`text-sm mb-4 ${p.featured ? "opacity-80" : "text-muted-foreground"}`}>{p.desc}</p>
                <Button variant={p.featured ? "secondary" : "outline"} asChild className="w-full">
                  <Link to="/register">Elegir</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SiteStayApp · Reservas corporativas con IA
      </footer>
    </div>
  );
};

export default Landing;