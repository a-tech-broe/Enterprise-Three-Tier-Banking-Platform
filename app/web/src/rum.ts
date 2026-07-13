// CloudWatch RUM — initialises only when env vars are provided
const APP_ID    = import.meta.env.VITE_RUM_APP_ID as string | undefined;
const POOL_ID   = import.meta.env.VITE_RUM_IDENTITY_POOL_ID as string | undefined;
const REGION    = (import.meta.env.VITE_AWS_REGION as string | undefined) ?? 'us-east-1';

if (APP_ID && POOL_ID) {
  import('aws-rum-web').then(({ AwsRum }) => {
    try {
      new AwsRum(APP_ID, '1.0.0', REGION, {
        sessionSampleRate: 1,
        identityPoolId:    POOL_ID,
        endpoint:          `https://dataplane.rum.${REGION}.amazonaws.com`,
        telemetries:       ['performance', 'errors', 'http'],
        allowCookies:      true,
        enableXRay:        false,
      });
    } catch {
      // RUM must never crash the app
    }
  }).catch(() => {});
}
