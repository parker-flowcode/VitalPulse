import { estimateBPCalibrated } from '../bpEstimator';
import useHealthStore from '../../store/healthstore';

// Helper to create a calibration point
function makePoint({ systolic, diastolic, bpm = 70 }) {
  return {
    realSystolic: systolic,
    realDiastolic: diastolic,
    morphology: {},
    bpm,
    sdnn: 0,
    date: new Date().toISOString(),
  };
}

// Dummy profile satisfying completeness check
const dummyProfile = {
  age: 45,
  weight: 80,
  height: 175,
  sex: 'male',
  isActive: true,
};

describe('estimateBPCalibrated – fallback (offset) behavior', () => {
  test('uses offset when not enough calibration points', () => {
    const calibration = { points: [makePoint({ systolic: 120, diastolic: 80 })] };
    const result = estimateBPCalibrated(
      { ptt: 0, risingSlope: 0, augmentationIndex: 0, pulseWidth: 0, dicroticNotch: 0 },
      70,
      calibration,
      dummyProfile,
      0
    );
    expect(result.calibrationMethod).toBe('offset');
    expect(result.isCalibrated).toBe(true);
  });
});

// Ensure the store prefers regression calibration for the regression tests
beforeAll(() => {
  useHealthStore.getState().updateSettings({ preferRegression: true });
});

describe('estimateBPCalibrated – regression path', () => {
  test('uses regression when enough points and profile is complete', () => {
    // Create 6 synthetic calibration points that follow a simple linear relationship
    const points = [];
    for (let i = 0; i < 6; i++) {
      const bpm = 60 + i * 5; // 60, 65, 70, ...
      const systolic = 110 + i * 2; // linear with bpm
      const diastolic = 70 + i; // linear with bpm
      points.push(makePoint({ systolic, diastolic, bpm }));
    }
    const calibration = { points };
    const result = estimateBPCalibrated(
      { ptt: 0, risingSlope: 0, augmentationIndex: 0, pulseWidth: 0, dicroticNotch: 0 },
      70,
      calibration,
      dummyProfile,
      0
    );
    expect(result.calibrationMethod).toBe('regression');
    expect(result.isCalibrated).toBe(true);
    // Verify that the predicted values are within physiological bounds
    expect(result.systolic).toBeGreaterThanOrEqual(100);
    expect(result.systolic).toBeLessThanOrEqual(200);
    expect(result.diastolic).toBeGreaterThanOrEqual(60);
    expect(result.diastolic).toBeLessThanOrEqual(130);
  });
});
