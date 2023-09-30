import { pages } from "./JUC";

const calculate = (current: number) => {
  let me_sum = 0;
  for (let i = 0; i < current; i++) {
    me_sum += pages[i].duration;
  }
  let total_sum = 0;
  pages.forEach((page) => {
    total_sum += page.duration;
  });

  let me_hours = me_sum / 3600;
  let total_hours = total_sum / 3600;
  console.log(`=======看了${current}集========`);
  console.log(`课程已经看了${me_hours.toFixed(3)}小时`);
  console.log(`课程总共${total_hours.toFixed(3)}小时`);
  console.log(`视频观看进度${(me_sum / total_sum).toFixed(3)}%`);
  console.log("======================");
};
const calculate_from_to = (from: number, to: number) => {
  let me_sum = 0;
  for (let i = from - 1; i < to; i++) {
    me_sum += pages[i].duration;
  }
  let total_sum = 0;
  pages.forEach((page) => {
    total_sum += page.duration;
  });

  let me_hours = me_sum / 3600;
  let total_hours = total_sum / 3600;
  console.log(`=======看了${to - from + 1}集========`);
  console.log(`课程已经看了${me_hours.toFixed(3)}小时`);
  console.log(`课程总共${total_hours.toFixed(3)}小时`);
  console.log(`视频观看进度${((me_sum / total_sum) * 100).toFixed(3)}%`);
  console.log("======================");
};

// calculate(5);

// console.log("周六 0923");
calculate_from_to(1, 134);
