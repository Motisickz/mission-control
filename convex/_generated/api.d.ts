/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminAuth from "../adminAuth.js";
import type * as adminMaintenance from "../adminMaintenance.js";
import type * as auth from "../auth.js";
import type * as authStatus from "../authStatus.js";
import type * as board from "../board.js";
import type * as calendar from "../calendar.js";
import type * as communication from "../communication.js";
import type * as communicationAi from "../communicationAi.js";
import type * as communicationAiStorage from "../communicationAiStorage.js";
import type * as communicationAutomation from "../communicationAutomation.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as ideas from "../ideas.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_sharedProfiles from "../lib/sharedProfiles.js";
import type * as missions from "../missions.js";
import type * as missionsTables from "../missionsTables.js";
import type * as notifications from "../notifications.js";
import type * as profiles from "../profiles.js";
import type * as seed from "../seed.js";
import type * as sharedAuth from "../sharedAuth.js";
import type * as tasks from "../tasks.js";
import type * as tasksTemplates from "../tasksTemplates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminAuth: typeof adminAuth;
  adminMaintenance: typeof adminMaintenance;
  auth: typeof auth;
  authStatus: typeof authStatus;
  board: typeof board;
  calendar: typeof calendar;
  communication: typeof communication;
  communicationAi: typeof communicationAi;
  communicationAiStorage: typeof communicationAiStorage;
  communicationAutomation: typeof communicationAutomation;
  crons: typeof crons;
  http: typeof http;
  ideas: typeof ideas;
  "lib/auth": typeof lib_auth;
  "lib/sharedProfiles": typeof lib_sharedProfiles;
  missions: typeof missions;
  missionsTables: typeof missionsTables;
  notifications: typeof notifications;
  profiles: typeof profiles;
  seed: typeof seed;
  sharedAuth: typeof sharedAuth;
  tasks: typeof tasks;
  tasksTemplates: typeof tasksTemplates;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
