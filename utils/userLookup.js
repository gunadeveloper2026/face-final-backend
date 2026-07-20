const mongoose = require('mongoose');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildUserLookupQueries = (identifier) => {
  const value = String(identifier || '').trim();
  if (!value) return [];

  const exact = { $regex: `^${escapeRegex(value)}$`, $options: 'i' };
  const contains = { $regex: escapeRegex(value), $options: 'i' };
  const queries = [];

  if (mongoose.Types.ObjectId.isValid(value)) {
    queries.push({ _id: value });
  }

  queries.push({ email: value.toLowerCase() });
  queries.push({ email: exact });
  queries.push({ name: exact });
  queries.push({ name: contains });

  return queries;
};

const findUserByIdentifier = async (UserModel, identifier) => {
  const queries = buildUserLookupQueries(identifier);
  for (const query of queries) {
    const user = await UserModel.findOne(query);
    if (user) {
      return user;
    }
  }
  return null;
};

module.exports = {
  buildUserLookupQueries,
  findUserByIdentifier,
};
