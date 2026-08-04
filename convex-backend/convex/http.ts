import { httpRouter } from "convex/server";
import { login, logout, me } from "./auth";
import { listGuests, upsertGuest, deleteGuest } from "./guests";
import { submitRsvp, rsvpStatus } from "./rsvp";

const http = httpRouter();

http.route({ path: "/api/auth/login", method: "POST", handler: login });
http.route({ path: "/api/auth/login", method: "OPTIONS", handler: login });

http.route({ path: "/api/auth/logout", method: "POST", handler: logout });
http.route({ path: "/api/auth/logout", method: "OPTIONS", handler: logout });

http.route({ path: "/api/auth/me", method: "GET", handler: me });
http.route({ path: "/api/auth/me", method: "OPTIONS", handler: me });

http.route({ path: "/api/guests", method: "GET", handler: listGuests });
http.route({ path: "/api/guests", method: "OPTIONS", handler: listGuests });

http.route({ path: "/api/guest", method: "POST", handler: upsertGuest });
http.route({ path: "/api/guest", method: "OPTIONS", handler: upsertGuest });

http.route({ path: "/api/guest/delete", method: "POST", handler: deleteGuest });
http.route({ path: "/api/guest/delete", method: "OPTIONS", handler: deleteGuest });

http.route({ path: "/api/rsvp", method: "POST", handler: submitRsvp });
http.route({ path: "/api/rsvp", method: "OPTIONS", handler: submitRsvp });

http.route({ path: "/api/rsvp/status", method: "GET", handler: rsvpStatus });
http.route({ path: "/api/rsvp/status", method: "OPTIONS", handler: rsvpStatus });

export default http;
