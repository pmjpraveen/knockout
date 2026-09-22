export type LegalSection = { heading: string; body: string[] };

/** Where people can reach you about their data. Fill this in before the app goes to a store: the policy shows a contact line once it is set. */
export const supportEmail = '';

export const legalUpdated = '21 September 2026';

export const terms: LegalSection[] = [
  { heading: 'About Knockout', body: ['Knockout helps organizers run karate tournaments: registering clubs, drawing brackets, scheduling rings and scoring matches. By using the app you agree to these terms.'] },
  { heading: 'Accounts', body: [
    'Tournament organizers sign in with Google or with an email and password. Organizers can create logins for tournament directors and scorekeepers; those people use the login they were given.',
    'You are responsible for what happens under your login. Keep your password private and tell the organizer if a login you were given should be removed.',
    'Clubs register athletes through a link the organizer shares. That link needs no account.',
  ] },
  { heading: 'What you may do', body: [
    'Use Knockout only to run or take part in tournaments, and only enter information you are allowed to share, including athletes\' details, which clubs must have permission to submit (for children, from a parent or guardian).',
    'Do not misuse the app, try to break into other people\'s tournaments, or upload anything unlawful or offensive, including cover images.',
  ] },
  { heading: 'Tournaments and data', body: [
    'A tournament belongs to the organizer who created it. The organizer decides who can see it and is responsible for the accuracy of what is entered.',
    'Scores, brackets and schedules are produced from what organizers and scorekeepers enter. Times on the schedule are estimates. Check results before announcing them.',
    'When a tournament is completed, its data is deleted automatically after 7 days.',
  ] },
  { heading: 'Deleting your account', body: ['You can delete your account any time from the profile menu. Deleting an organizer account also deletes the tournaments they own and everything in them.'] },
  { heading: 'No warranty and limits', body: [
    'Knockout is provided as it is. We work to keep it available and accurate but do not promise it will always work, especially with a poor connection.',
    'To the extent the law allows, we are not liable for indirect losses, or for losses from a tournament decision based on data in the app.',
  ] },
  { heading: 'Changes', body: ['We may update these terms. The date at the top shows when they last changed. Using the app after a change means you accept it.'] },
];

export const privacy: LegalSection[] = [
  { heading: 'What we collect', body: [
    'Organizers and staff: your email address and, if you use Google, your name and profile picture. Passwords are stored by our authentication provider in hashed form.',
    'Athletes: for each athlete a club registers, the tournament records their name, date of birth, gender, weight, belt and which events they enter, plus the club name and a contact given by the club. Some athletes are children.',
    'Tournament activity: categories, brackets, schedules, scores, penalties, results and a log of changes organizers make, such as overriding a participant\'s details.',
    'Images: the cover image an organizer uploads for a tournament.',
    'On your device: the app keeps recent tournament data and unsent scores so it works without a connection.',
  ] },
  { heading: 'How we use it', body: [
    'Only to run the tournament: registering athletes, placing them in categories and brackets, scheduling rings, scoring, and showing results and the public schedule.',
    'We do not sell your data, show ads, or use it for tracking.',
  ] },
  { heading: 'Who sees it', body: [
    'The organizer of a tournament sees everything in it. Tournament directors and scorekeepers see what they need to run their rings.',
    'The public schedule link shows athlete names, rings, rounds and estimated times, but not dates of birth, weights or clubs.',
    'We use service providers to host the app: Supabase (database and sign-in), Vercel (website) and Expo (app updates). They process data for us and do not use it for their own purposes.',
  ] },
  { heading: 'How long we keep it', body: [
    'A tournament\'s data, including its athletes, is deleted automatically 7 days after the organizer marks the tournament completed. Drafts and unfinished tournaments stay until the organizer deletes them.',
    'Deleting your account removes your login, and for organizers every tournament they own.',
  ] },
  { heading: 'Your choices', body: [
    'You can delete your account in the app from the profile menu. To have an athlete\'s details corrected or removed, ask the club or the organizer who entered them.',
  ] },
  { heading: 'Children', body: ['Knockout is not aimed at children. Athletes\' details are entered by clubs and organizers, who must have a parent or guardian\'s permission.'] },
  { heading: 'Security', body: ['Data is sent over encrypted connections and access is limited by role. No system is perfectly secure, so tell us if you think something is wrong.'] },
  { heading: 'Changes', body: ['If this policy changes, the date at the top changes too.'] },
];
