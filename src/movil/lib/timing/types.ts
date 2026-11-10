/**
 * Motor de tiempos de rodaje — contratos.
 *
 * Todos los instantes son epoch en milisegundos. Las duraciones se acumulan
 * en milisegundos y solo se convierten a minutos para mostrar.
 */

export type Situation =
  | 'noPlan'
  | 'scheduled'
  | 'concludedDay'
  | 'notStarted'
  | 'inProgress'
  | 'finished'
  | 'finishedWithoutCompletion';

export type Warning =
  | 'defaultCalledTime'
  | 'duplicateOrder'
  | 'pendingBeforeCompleted'
  | 'completionBeforeCalled'
  | 'completionInFuture'
  | 'unreadableCompletion';

export interface RowInput {
  id: string | number;
  /** Posición en el plan, ascendente. */
  order: number;
  /** Puede ser fraccionaria. */
  plannedDurationMinutes: number;
  /** Se deriva de tener cierre; el motor no confía en un booleano aislado. */
  isCompleted: boolean;
  /** Instante ISO o "HH:mm"; es el CIERRE de la toma, no su inicio. */
  completedAt: string | null;
}

export interface PlanInput {
  rows: RowInput[];
  /** "YYYY-MM-DD" */
  date: string | null;
  /** "HH:mm" */
  callTime: string | null;
  /** IANA; null o inválida usa la zona del entorno. */
  timeZone: string | null;
  /** Epoch ms inyectado: el motor nunca lee el reloj. */
  now: number;
  toleranceMinutes?: number;
}

export interface RowProjection {
  id: string | number;
  order: number;
  plannedStart: number;
  plannedEnd: number;
  /** Inicio estimado. */
  projectedStart: number;
  /** Fin estimado. */
  projectedEnd: number;
  /** Cierre de la toma anterior (o el llamado). */
  realStart: number | null;
  completedAt: number | null;
  /** Ms entre cierres consecutivos. */
  realDuration: number | null;
  /** Ms con signo: + atrasado, − adelantado. */
  deviation: number | null;
  isActive: boolean;
  isCompleted: boolean;
}

export interface Status {
  situation: Situation;
  /** Ms con signo. */
  deviation: number | null;
  /** Ms. */
  tolerance: number;
  isOnTime: boolean;
  activeRowId: string | number | null;
  activeStartedAt: number | null;
  minutesUntilStart: number | null;
  /** "YYYY-MM-DD" del llamado en la zona del rodaje. */
  calledDay: string;
}

export interface Plan {
  calledAt: number;
  plannedEnd: number;
  projectedEnd: number;
  timeZone: string;
  status: Status;
  rows: RowProjection[];
  warnings: Warning[];
}
