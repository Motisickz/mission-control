import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Runs frequently so "prepStartDate" triggers even with DST changes.
crons.hourly(
  "communication.ensurePrepTasksForDueEvents",
  { minuteUTC: 5 },
  internal.communicationAutomation.ensurePrepTasksForDueEvents,
  {},
);

export default crons;

