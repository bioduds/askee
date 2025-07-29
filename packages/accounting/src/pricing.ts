type TaskType = 'ml_training' | 'data_processing' | 'scientific_compute';

const base: Record<TaskType, number> = {
    ml_training: 1.5, data_processing: 1.0, scientific_compute: 1.2
};

export function priceRate(taskType: TaskType, supply: number, demand: number): number {
    const s = Math.max(supply, 1);
    const d = Math.max(demand, 1);
    const surge = d / s;
    const rate = base[taskType] * surge;
    return Math.min(Math.max(rate, 0.2), 5.0); // clamp
}

export function earn(
    taskType: TaskType,
    measures: { NCU_s?: number; GCU_s?: number; IO_GB?: number },
    reputation: number
): number {
    const ncu = measures.NCU_s ?? 0;
    const gcu = measures.GCU_s ?? 0;
    const io = measures.IO_GB ?? 0;
    const mult = 0.8 + Math.min(Math.max(reputation, 0), 100) / 500; // 0.8..1.0
    // supply/demand can be injected by coordinator; using 1 for now
    return (ncu + 0.7 * gcu + 0.05 * io) * priceRate(taskType, 1, 1) * mult;
}
