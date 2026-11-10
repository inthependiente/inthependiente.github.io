import TabBar from './components/TabBar';
import {
  ErrorScreen,
  InvalidLinkScreen,
  LoadingScreen,
  MissingLinkScreen,
  NotFoundScreen,
} from './components/ScreenStates';
import { useAcceso } from './data/useAcceso';
import { useLlamadoData } from './data/useLlamadoData';
import { readLinkParams } from './lib/params';
import { useRoute } from './lib/router';
import GenteScreen from './screens/GenteScreen';
import LlamadoScreen from './screens/LlamadoScreen';
import LocacionesScreen from './screens/LocacionesScreen';
import PlanRodajeScreen from './screens/PlanRodajeScreen';

const params = readLinkParams();

export default function App() {
  const { tab, id, genteTab } = useRoute();

  // Resuelve el código corto (o el token) antes de cargar el llamado: el
  // código identifica a la vez a la persona y el llamado.
  const acceso = useAcceso({
    llamadoIdUrl: params.llamadoId,
    token: params.token,
    codigo: params.codigo,
  });

  const { data, guardadoEn, cargando, error, noEncontrado, recargar } = useLlamadoData(
    acceso.llamadoId ?? Number.NaN,
  );

  const contenido = () => {
    if (acceso.resolviendo) return <LoadingScreen />;
    if (acceso.enlaceInvalido) return <InvalidLinkScreen />;
    if (acceso.errorResolucion) {
      return <ErrorScreen mensaje={acceso.errorResolucion} onRetry={acceso.reintentarResolucion} />;
    }
    if (!Number.isFinite(acceso.llamadoId as number)) return <MissingLinkScreen />;
    if (noEncontrado) return <NotFoundScreen />;
    if (cargando && !data) return <LoadingScreen />;
    if (!data) return <ErrorScreen mensaje={error} onRetry={recargar} />;

    if (tab === 'llamado') {
      return (
        <LlamadoScreen
          data={data}
          acceso={acceso}
          guardadoEn={guardadoEn}
          error={error}
          recargar={recargar}
        />
      );
    }

    if (tab === 'pdr') return <PlanRodajeScreen data={data} />;
    if (tab === 'locaciones') return <LocacionesScreen data={data} />;
    return <GenteScreen data={data} genteTab={genteTab} seleccionadoId={id} />;
  };

  return (
    <div className="min-h-dvh bg-canvas text-content">
      <main
        className="mx-auto w-full max-w-[520px]"
        style={{
          paddingBottom: tab === 'locaciones'
            ? 'calc(var(--tabbar-h) + env(safe-area-inset-bottom))'
            : tab === 'llamado'
              ? 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 7.5rem)'
              : 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        {contenido()}
      </main>

      <TabBar active={tab} />
    </div>
  );
}
