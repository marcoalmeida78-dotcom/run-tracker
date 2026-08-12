import * as TaskManager from 'expo-task-manager';

// --- TAREFA DE LOCALIZAÇÃO EM SEGUNDO PLANO ---
export const LOCATION_TASK_NAME = 'zero-aos-5k-background-location';

// Handler dinâmico: o ecrã de exercício regista aqui a função que trata
// cada atualização de posição recebida em segundo plano.
let backgroundLocationUpdateHandler = null;

export const setBackgroundLocationHandler = (handler) => {
  backgroundLocationUpdateHandler = handler;
};

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
    if (error) {
      return;
    }
    if (data) {
      const { locations } = data;
      if (backgroundLocationUpdateHandler && locations && locations.length > 0) {
        locations.forEach((loc) => backgroundLocationUpdateHandler(loc));
      }
    }
  });
}
