import { createServer } from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";

const httpServer = createServer();
const io = new Server(httpServer, {
  /* options */
  cors: {
    origin: [
      "http://localhost", // android
      "capacitor://localhost", // ios
      "http://localhost:8100", // web browser local
      "http://192.168.8.80:8100", // web browser local and on network
      "https://admin.socket.io",
    ],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`New Connection from ${socket?.id}`);

  // Driver comes online
  socket.on("join_drivers_room", (driverId, callback) => {
    socket.join("drivers_room");
    callback(`Successfully joined drivers' room: ${driverId}`);
  });

  // Driver goes offline or unmounts
  socket.on("leave_drivers_room", (driverId, callback) => {
    socket.leave("drivers_room");
    callback(`Successfully left drivers' room: ${driverId}`);
  });

  // Dispatch ride offer: To drivers
  socket.on("ride_offer", (offer) => {
    console.log(offer);

    // User join his own trip room
    socket.join(`trip_room:${offer?.passengerID}`);

    // Send message to drivers
    io.to("drivers_room").emit("new_ride_offer", offer);
  });

  // Join trip room: Accept ride
  socket.on(
    `join_trip_room`,
    ({ passengerID, dbTripID, joiner } = trip, callback) => {
      // Driver joins passenger's room
      socket.join(`trip_room:${passengerID}`);
      console.log(dbTripID);
      if (joiner === "driver") {
        // Accept ride
        io.to(`trip_room:${passengerID}`).emit(`ride_accepted`, dbTripID);

        io.to(`drivers_room`).emit(`remove_ride_offer`, {
          passengerID,
        });
      }

      callback({ ok: true });
    }
  );

  // Emit new car latLng
  socket.on(`car_latLng`, (params) => {
    console.log("New car lat lng");
    console.log(params?.passengerID);
    io.to(`trip_room:${params?.passengerID}`).emit(
      `car_latLng`,
      params?.carLatLng
    );
  });

  // Remove ride offer from list
  socket.on(`remove_ride_offer`, (params) => {
    io.to(`drivers_room`).emit(`remove_ride_offer`, {
      passengerID: params?.passengerID,
    });
  });

  // Leave trip room: Cancel ride
  socket.on("leave_trip_room", (params) => {
    // A client (socket) leaves trip room
    io.to(`trip_room:${params?.passengerID}`).emit(`ride_cancelled`);
    socket.leave(`trip_room:${params?.passengerID}`);
  });
});

instrument(io, {
  auth: false,
  mode: "development",
});

httpServer.listen(process.env.PORT || 4000, () => {
  console.log(`Server Running on port ${process.env.PORT || 4000}`);
});
