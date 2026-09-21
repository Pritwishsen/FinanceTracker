// Runs once in the parent Jest process, before any test worker starts, so the
// TZ setting is inherited by every worker. (Setting process.env.TZ inside a test
// file does NOT work: Jest gives each test file a copy of process.env, so the
// change never reaches Node's real timezone.)
//
// A negative-UTC-offset zone is pinned deliberately: it's the zone where UTC-vs-
// local date bugs (new Date('YYYY-MM-DD') parses as UTC midnight) actually show
// up. On a UK/UTC machine or a UTC CI runner they'd pass by coincidence.
module.exports = async () => {
    process.env.TZ = 'America/Los_Angeles';
};
