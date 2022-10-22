import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ConnectionService } from './ConnectionService/connection.service';
import { SyncService } from './SyncService/sync.service';
import * as localforage from 'localforage';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  public todos: any[]
  public connectionState: boolean = true
  public offlineClicked: boolean = false
  public onlineTodoSent: boolean = false
  public pendingTodos: number = 0
  constructor(private http: HttpClient, private connection: ConnectionService, private sync: SyncService) { }
  //call the fake API endpoint to fetch some data. Easy enough.
  fetchTodos() {
    if (!this.connectionState) this.offlineClicked = true
    this.http.get<any[]>("https://jsonplaceholder.typicode.com/todos").subscribe(todos => {
      console.log(todos);
      this.todos = todos.slice(0, 5)
    })
  }

  clearTodos() {
    this.todos = []
  }

  sendTodo(): void {
    this.sync.tryPost<{ id: number, title: string, body: string, userId: number }>("https://jsonplaceholder.typicode.com/todos", {
      id: 23, title: "Make an awesome app", body: "Revolutionize the App industry", userId: 2323
    }).subscribe({
      next: response => {
        console.log('successfully posted!', response)
        alert('Todo posted successfully!')
        this.onlineTodoSent = true
      }
    })
  }

  ngOnInit() {
    this.connectionState = this.connection.getOnlineStatus()
    this.connection.listen().subscribe(status => {
      if (!this.connectionState && status === 1) {
        setTimeout(() => {
          console.log('start sync');
          this.sync.sync().subscribe(x => {
            console.log('sync results', x);
          })
        }, 4000)
      }
      this.connectionState = status === 1
      console.log('connection', this.connectionState);
    })
  }

}
