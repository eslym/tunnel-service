const gulp = require('gulp');
const ts = require('gulp-typescript');
const clean = require('gulp-clean');
const sourcemaps = require('gulp-sourcemaps');
const merge = require('merge2');

const proj = ts.createProject('./tsconfig.json');

gulp.task('build', function () {
    const result = proj.src()
        .pipe(sourcemaps.init())
        .pipe(proj());

    return merge([
        result.js
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest('dist')),
        result.dts.pipe(gulp.dest('dist')),
        gulp.src('./src/**/*.d.ts')
            .pipe(gulp.dest('dist'))
    ]);
});

gulp.task('clean', function () {
    return gulp.src(['dist'], {read: false, allowEmpty:true})
        .pipe(clean());
});

gulp.task('watch', function () {
    return gulp.watch(proj.config.include, gulp.task('build'));
});
