import type { Card } from '../types';

const HPA = 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/';
const JOBS = 'https://kubernetes.io/docs/concepts/workloads/controllers/job/';
const CRON = 'https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/';

export const cards: Card[] = [
  {
    id: 'hpa-01',
    type: 'concept',
    domain: 'workloads',
    topic: 'Autoscaling',
    week: 4,
    title: 'HPA scales replicas on metrics',
    body: 'A HorizontalPodAutoscaler changes a Deployment\'s replicas so average usage stays near a target, like 70% CPU. Utilization is measured against requests, and metrics come from metrics-server.',
    check: {
      q: 'An HPA targets 70% CPU but shows <unknown>/70%. Most likely cause?',
      options: ['Pods have no CPU requests, or metrics-server is missing', 'The target is too low', 'maxReplicas is reached', 'The Deployment uses Recreate'],
      answer: 0,
    },
    explain: 'Utilization is usage ÷ request, so without requests it can\'t be computed. Without metrics-server there is no usage data at all.',
    docs: HPA,
  },
  {
    id: 'hpa-02',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Autoscaling',
    week: 4,
    task: 'Autoscale Deployment web between 2 and 10 replicas at 70% CPU.',
    answer: 'kubectl autoscale deployment web --min=2 --max=10 --cpu-percent=70',
    distractors: ['scale', '--replicas=10', '--target=70'],
    explain: 'Creates an autoscaling/v2 HPA named web. Check it with `kubectl get hpa` and `kubectl describe hpa web`.',
    docs: HPA,
  },
  {
    id: 'hpa-03',
    type: 'yaml',
    domain: 'workloads',
    topic: 'Autoscaling',
    week: 4,
    task: 'This HPA should scale Deployment web. Tap the broken line.',
    yaml: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Pod
    name: web
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70`,
    bugLine: 7,
    fixLine: '    kind: Deployment',
    explain: 'scaleTargetRef must point at something with a scale subresource: Deployment, StatefulSet or ReplicaSet. A Pod can\'t be scaled.',
  },
  {
    id: 'hpa-04',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Autoscaling',
    week: 4,
    q: 'Load drops. Roughly how long does an HPA wait by default before scaling down?',
    options: ['5 minutes (stabilization window)', 'Immediately', '30 seconds', '1 hour'],
    answer: 0,
    explain: 'scaleDown.stabilizationWindowSeconds defaults to 300 to avoid flapping. Tune it in spec.behavior (autoscaling/v2).',
  },
  {
    id: 'hpa-05',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Autoscaling',
    week: 4,
    q: 'You `kubectl scale deployment web --replicas=1` while an HPA (min 2) manages it. What happens?',
    options: ['The HPA scales it back to at least 2', 'It stays at 1', 'The HPA is deleted', 'The command is rejected'],
    answer: 0,
    explain: 'The HPA owns the replica count and keeps enforcing min/max. Delete or edit the HPA to change behaviour.',
  },
  {
    id: 'job-01',
    type: 'concept',
    domain: 'workloads',
    topic: 'Jobs',
    week: 4,
    title: 'Jobs run to completion',
    body: 'A Job keeps creating Pods until N of them succeed (completions), with up to parallelism at once. Failed Pods are retried up to backoffLimit (default 6). A CronJob creates Jobs on a schedule.',
    check: {
      q: 'Which restartPolicy values are allowed in a Job\'s Pod template?',
      options: ['OnFailure or Never', 'Always only', 'Any of the three', 'None; Jobs ignore it'],
      answer: 0,
    },
    explain: 'Always would never let the Job finish, so the API rejects it.',
    docs: JOBS,
  },
  {
    id: 'job-02',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Jobs',
    week: 4,
    task: 'Create a Job hello with image busybox that runs `echo hi`.',
    answer: 'kubectl create job hello --image=busybox -- echo hi',
    distractors: ['run', '--restart=Never', '--schedule'],
    explain: 'Read the output with `kubectl logs job/hello`.',
  },
  {
    id: 'job-03',
    type: 'yaml',
    domain: 'workloads',
    topic: 'Jobs',
    week: 4,
    task: 'Run 5 successful Pods, 2 at a time. Tap the broken line.',
    yaml: `apiVersion: batch/v1
kind: Job
metadata:
  name: batch
spec:
  completions: 5
  parallel: 2
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: work
        image: busybox
        command: ["sh", "-c", "echo working"]`,
    bugLine: 6,
    fixLine: '  parallelism: 2',
    explain: 'The field is parallelism. completions = total successes needed, parallelism = Pods running at once.',
    docs: JOBS,
  },
  {
    id: 'job-04',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Jobs',
    week: 4,
    q: 'Which Job field deletes the finished Job (and its Pods) automatically after N seconds?',
    options: ['ttlSecondsAfterFinished', 'activeDeadlineSeconds', 'backoffLimit', 'successfulJobsHistoryLimit'],
    answer: 0,
    explain: 'activeDeadlineSeconds kills a Job that runs too long. ttlSecondsAfterFinished cleans up after it finishes.',
  },
  {
    id: 'job-05',
    type: 'mcq',
    domain: 'workloads',
    topic: 'CronJobs',
    week: 4,
    q: 'What does the schedule "*/15 * * * *" mean?',
    options: ['Every 15 minutes', 'At minute 15 of every hour', 'Every 15 hours', 'On the 15th of every month'],
    answer: 0,
    explain: 'Fields: minute hour day-of-month month day-of-week. "0 2 * * *" = daily at 02:00.',
    docs: CRON,
  },
  {
    id: 'job-06',
    type: 'cmd',
    domain: 'workloads',
    topic: 'CronJobs',
    week: 4,
    task: 'Trigger CronJob backup right now by creating a Job manual-1 from it.',
    answer: 'kubectl create job manual-1 --from=cronjob/backup',
    distractors: ['--trigger', 'run', 'cronjob/backup'],
    explain: 'Great for testing a CronJob without waiting for its schedule.',
  },
  {
    id: 'job-07',
    type: 'mcq',
    domain: 'workloads',
    topic: 'CronJobs',
    week: 4,
    q: 'A CronJob run is still going when the next one is due. Which concurrencyPolicy skips the new run?',
    options: ['Forbid', 'Replace', 'Allow', 'Skip'],
    answer: 0,
    explain: 'Allow (default) runs both, Forbid skips the new one, and Replace kills the old one and starts the new one.',
    docs: CRON + '#concurrency-policy',
  },
  {
    id: 'job-08',
    type: 'yaml',
    domain: 'workloads',
    topic: 'CronJobs',
    week: 4,
    task: 'The API server rejects this CronJob. Tap the broken line.',
    yaml: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Always
          containers:
          - name: backup
            image: busybox
            command: ["sh", "-c", "date"]`,
    bugLine: 10,
    fixLine: '          restartPolicy: OnFailure',
    explain: 'Job Pods must use OnFailure or Never. Note the nesting: CronJob → jobTemplate → spec → template → spec.',
  },
  {
    id: 'ds-01',
    type: 'concept',
    domain: 'workloads',
    topic: 'DaemonSets',
    week: 4,
    title: 'No `kubectl create daemonset`',
    body: 'There is no imperative command for DaemonSets. Generate Deployment YAML with --dry-run=client -o yaml, change kind to DaemonSet, and delete replicas, strategy and status.',
    check: {
      q: 'Which field must you remove when turning Deployment YAML into a DaemonSet?',
      options: ['spec.replicas', 'spec.selector', 'spec.template', 'metadata.name'],
      answer: 0,
    },
    explain: 'A DaemonSet runs one Pod per eligible node, so replicas makes no sense. selector and template stay.',
    docs: 'https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/',
  },
  {
    id: 'ds-02',
    type: 'mcq',
    domain: 'workloads',
    topic: 'DaemonSets',
    week: 4,
    q: 'A DaemonSet Pod does not run on the control-plane node. How do you include it?',
    options: [
      'Add a toleration for node-role.kubernetes.io/control-plane:NoSchedule',
      'Set replicas to the node count',
      'Add nodeName to the template',
      'Delete the DaemonSet and use a Deployment',
    ],
    answer: 0,
    explain: 'DaemonSets respect taints too. Tolerate the control-plane taint to cover every node.',
  },
  {
    id: 'job-09',
    type: 'mcq',
    domain: 'troubleshooting',
    topic: 'Jobs',
    week: 4,
    boss: true,
    q: 'A Job shows 0/1 completions, and its Pods are gone after several failures. Status says BackoffLimitExceeded. Fastest way to see why?',
    options: [
      'kubectl describe job <name> for events, then fix and re-create the Job',
      'kubectl rollout undo job <name>',
      'kubectl scale job <name> --replicas=1',
      'kubectl edit job and set restartPolicy: Always',
    ],
    answer: 0,
    explain: 'Jobs have no rollouts or replicas. Events show the failures. Pods may be cleaned up, so check logs early, or raise backoffLimit while debugging.',
  },
];
