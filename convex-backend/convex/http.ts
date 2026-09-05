import { httpRouter } from "convex/server";
import { login, logout, me } from "./auth";
import { listGuests, upsertGuest, deleteGuest, importGuests, markInviteSentAction } from "./guests";
import { submitRsvp, rsvpStatus, rsvpCount } from "./rsvp";
import { listSongsHttp, createSongHttp, voteSongHttp } from "./songs";
import { listMessagesHttp } from "./messages";

const http = httpRouter();

http.route({ path: "/api/auth/login", method: "POST", handler: login });
http.route({ path: "/api/auth/login", method: "OPTIONS", handler: login });

http.route({ path: "/api/auth/logout", method: "POST", handler: logout });
http.route({ path: "/api/auth/logout", method: "OPTIONS", handler: logout });

http.route({ path: "/api/auth/me", method: "GET", handler: me });
http.route({ path: "/api/auth/me", method: "OPTIONS", handler: me });

http.route({ path: "/api/guests", method: "GET", handler: listGuests });
http.route({ path: "/api/guests", method: "OPTIONS", handler: listGuests });

http.route({ path: "/api/guests/import", method: "POST", handler: importGuests });
http.route({ path: "/api/guests/import", method: "OPTIONS", handler: importGuests });

http.route({ path: "/api/guest", method: "POST", handler: upsertGuest });
http.route({ path: "/api/guest", method: "OPTIONS", handler: upsertGuest });

http.route({ path: "/api/guest/delete", method: "POST", handler: deleteGuest });
http.route({ path: "/api/guest/delete", method: "OPTIONS", handler: deleteGuest });

http.route({ path: "/api/guest/sent", method: "POST", handler: markInviteSentAction });
http.route({ path: "/api/guest/sent", method: "OPTIONS", handler: markInviteSentAction });

http.route({ path: "/api/rsvp", method: "POST", handler: submitRsvp });
http.route({ path: "/api/rsvp", method: "OPTIONS", handler: submitRsvp });

http.route({ path: "/api/rsvp/status", method: "GET", handler: rsvpStatus });
http.route({ path: "/api/rsvp/status", method: "OPTIONS", handler: rsvpStatus });

http.route({ path: "/api/rsvp/count", method: "GET", handler: rsvpCount });
http.route({ path: "/api/rsvp/count", method: "OPTIONS", handler: rsvpCount });

http.route({ path: "/api/songs", method: "GET", handler: listSongsHttp });
http.route({ path: "/api/songs", method: "OPTIONS", handler: listSongsHttp });

http.route({ path: "/api/song", method: "POST", handler: createSongHttp });
http.route({ path: "/api/song", method: "OPTIONS", handler: createSongHttp });

http.route({ path: "/api/song/vote", method: "POST", handler: voteSongHttp });
http.route({ path: "/api/song/vote", method: "OPTIONS", handler: voteSongHttp });

http.route({ path: "/api/messages", method: "GET", handler: listMessagesHttp });
http.route({ path: "/api/messages", method: "OPTIONS", handler: listMessagesHttp });

export default http;
