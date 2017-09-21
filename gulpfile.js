const gulp = require('gulp');
const zip = require('gulp-zip');
 
gulp.task('package', () =>
  gulp.src(['main.js', 'lambda.js', 'src*/**/*', 'node_modules*/**/*'])
    .pipe(zip('mirrorgate-aws-cloudwatch-metrics-collector.zip'))
    .pipe(gulp.dest('build'))
);