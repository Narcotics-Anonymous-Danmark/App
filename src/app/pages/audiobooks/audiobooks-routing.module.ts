import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AudioBooksPage } from './audiobooks.page';

const routes: Routes = [
  {
    path: '',
    component: AudioBooksPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AudioBooksPageRoutingModule {}
