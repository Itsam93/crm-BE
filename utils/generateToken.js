import jwt from "jsonwebtoken";

const generateToken = (payload, secret, expiresIn = "7d") => {
  return jwt.sign(payload, secret, { expiresIn });
};

export default generateToken;
