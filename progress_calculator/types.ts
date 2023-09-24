export interface Page {
  cid: number;
  page: number;

  from: string;
  part: string;
  duration: number;

  vid: string;
  weblink: string;

  dimension: any;
  first_frame?: string;
}
