const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: 'dxmIRodRoLhX7SnsqbeF79kcu',
  appSecret: '2bqapDuA1ZdriVhSO7Se2yFhcFjGhHCiSq6shdYX70PXg95qsl',
  accessToken: '1902050093093810179-oFkPfb5BXDsYyQOWdr1OseRhz5XhES',
  accessSecret: 'MZZ4n6NmLwJYA6x2nZkHHXyAsn4uQSrYtMT0sKURvU3z4',
});

async function run() {
  const me = await client.v2.me({ 'user.fields': ['public_metrics'] });
  console.log('=== PROFILE (V2) ===');
  console.log('Name:', me.data.name);
  console.log('Handle:', me.data.username);
  console.log('Followers:', me.data.public_metrics.followers_count);
  console.log('Following:', me.data.public_metrics.following_count);
  console.log('Tweets:', me.data.public_metrics.tweet_count);

  const timeline = await client.v2.userTimeline(me.data.id, {
    exclude: ['retweets', 'replies'],
    max_results: 100,
    'tweet.fields': ['public_metrics', 'created_at']
  });

  const tweets = timeline.data?.data || [];
  console.log('\n=== ENGAGEMENT (Last', tweets.length, 'tweets) ===');
  let totalRT = 0, totalFav = 0;
  const dailyMap = {};

  for (const t of tweets) {
    const rt = t.public_metrics?.retweet_count || 0;
    const fav = t.public_metrics?.like_count || 0;
    totalRT += rt;
    totalFav += fav;
    const day = t.created_at ? t.created_at.split('T')[0] : 'Unknown';
    if (!dailyMap[day]) dailyMap[day] = { tweets: 0, rt: 0, fav: 0 };
    dailyMap[day].tweets++;
    dailyMap[day].rt += rt;
    dailyMap[day].fav += fav;
  }

  console.log('Total Retweets:', totalRT);
  console.log('Total Likes:', totalFav);
  console.log('Total Engagements:', totalRT + totalFav);
  if (tweets.length > 0) console.log('Avg Engagement/Tweet:', ((totalRT + totalFav) / tweets.length).toFixed(1));

  console.log('\n=== DAILY BREAKDOWN ===');
  Object.entries(dailyMap).sort().forEach(([day, d]) => {
    console.log(day, '|', d.tweets, 'tweets |', d.rt, 'RT |', d.fav, 'Fav');
  });
}

run().catch(e => console.error('Error:', e.data || e.message || e));
