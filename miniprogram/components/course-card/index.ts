import { Course, Period } from '../../types/index';
import { DEFAULT_PERIODS } from '../../constants/periods';

Component({
  properties: {
    course: { type: Object, value: {} as Course },
    periods: { type: Array, value: DEFAULT_PERIODS as Period[] },
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', this.properties.course);
    },

    getPeriodTime(periodIdx: number): string {
      const periods = this.properties.periods as Period[];
      const p = periods.find(p => p.index === periodIdx);
      return p ? `${p.startTime} - ${p.endTime}` : '';
    }
  }
});
