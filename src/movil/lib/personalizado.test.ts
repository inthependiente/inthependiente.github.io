import assert from 'node:assert/strict';
import test from 'node:test';
import type { CrewLlamado } from '../types';
import { horaPersonalizada } from './personalizado';

const crew: CrewLlamado[] = [
  {
    id: 1,
    crew_id: 7,
    orden: 1,
    hora_llamado: '6:15',
    notas: null,
    crew: {
      id: 7,
      nombre: 'Daniela Rojas',
      cargo: 'Directora',
      departamento: 'Dirección',
      celular: null,
      llamado_hora: '08:00',
      notas: null,
    },
  },
  {
    id: 2,
    crew_id: 9,
    orden: 2,
    hora_llamado: null,
    notas: null,
    crew: {
      id: 9,
      nombre: 'Marco Díaz',
      cargo: 'Gaffer',
      departamento: 'Iluminación',
      celular: null,
      llamado_hora: '07:45',
      notas: null,
    },
  },
  {
    id: 3,
    crew_id: 11,
    orden: 3,
    hora_llamado: null,
    notas: null,
    crew: {
      id: 11,
      nombre: 'Sin Hora',
      cargo: null,
      departamento: null,
      celular: null,
      llamado_hora: null,
      notas: null,
    },
  },
];

test('usa la hora propia del crew en el llamado', () => {
  assert.deepEqual(horaPersonalizada(crew, { crewId: 7, nombre: 'Daniela Rojas' }, '07:00'), {
    nombre: 'Daniela Rojas',
    hora: '06:15',
  });
});

test('cae a la hora del crew y luego a la general', () => {
  assert.deepEqual(horaPersonalizada(crew, { crewId: 9, nombre: 'Marco Díaz' }, '07:00'), {
    nombre: 'Marco Díaz',
    hora: '07:45',
  });
  assert.deepEqual(horaPersonalizada(crew, { crewId: 11, nombre: 'Sin Hora' }, '7:00'), {
    nombre: 'Sin Hora',
    hora: '07:00',
  });
  assert.deepEqual(horaPersonalizada(crew, { crewId: 11, nombre: 'Sin Hora' }, null), {
    nombre: 'Sin Hora',
    hora: null,
  });
});

test('sin persona identificada no personaliza', () => {
  assert.equal(horaPersonalizada(crew, null, '07:00'), null);
});

test('usa el nombre del crew aunque el de la caché venga vacío', () => {
  assert.deepEqual(horaPersonalizada(crew, { crewId: 7, nombre: '' }, null), {
    nombre: 'Daniela Rojas',
    hora: '06:15',
  });
});
